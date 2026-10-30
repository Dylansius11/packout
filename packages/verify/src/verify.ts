import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { ApiPromise } from '@polkadot/api';
import { type Hex, hexToBytes, keccak256, stringToHex } from 'viem';
import { type ChainReader, DEFAULT_RPC, readChain } from './chain.ts';
import { type Bundle, bundleSchema, opSchema } from './format.ts';
import { nextHead, ZERO_HEAD } from './head.ts';
import { connectNative, DEFAULT_NATIVE_RPC, type NativeOptions } from './native.ts';

export const STEP_NAMES = {
  format: 'Format',
  envelopes: 'Envelopes',
  head: 'Head chain',
  anchored: 'Anchored on chain',
  complete: 'Completeness',
  decrypt: 'Decrypt and read',
} as const;
type StepId = keyof typeof STEP_NAMES;
export interface Step {
  id: StepId;
  status: 'pass' | 'fail' | 'skipped' | 'not checked';
  message: string;
}
export interface Report {
  ok: boolean;
  rpc: string;
  trust: string;
  steps: Step[];
}
const journalSchemaId = keccak256(stringToHex('packout.journal/1'));

export async function verifyBundle(input: {
  bundle: unknown;
  key?: Uint8Array;
  keyError?: string;
  rpc?: string;
  chain?: ChainReader;
  native?: NativeOptions;
}): Promise<Report> {
  const rpc = input.rpc ?? DEFAULT_RPC;
  const report: Report = {
    ok: false,
    rpc,
    trust: input.native
      ? `Trusts RPC ${rpc} and native RPC ${input.native.rpc ?? DEFAULT_NATIVE_RPC} for chain identity, registry state and finalized admission events; this is not light-client verification.`
      : `Trusts RPC ${rpc} for chain identity, registry state and admission events; this is not light-client verification.`,
    steps: (Object.keys(STEP_NAMES) as StepId[]).map((id) => ({
      id,
      status: 'not checked',
      message: 'Not checked because an earlier step failed.',
    })),
  };
  let current = 0;
  let ownedNative: ApiPromise | undefined;
  try {
    let value = input.bundle;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error('This file is not a PACKOUT bundle v1: invalid JSON.');
      }
    }
    const parsed = bundleSchema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(
        `This file is not a PACKOUT bundle v1: ${issue.path.join('.') || 'bundle'} ${issue.message}.`,
      );
    }
    const bundle: Bundle = parsed.data;
    report.steps[current++] = {
      id: 'format',
      status: 'pass',
      message: `PACKOUT bundle v1 contains ${bundle.checkpoint.count} operations with a matching checkpoint count.`,
    };

    const envelopes = bundle.envelopes.map((envelope, index) => {
      const bytes = hexToBytes(envelope);
      if (bytes.length < 41)
        throw new Error(
          `Operation ${index + 1} is damaged: it is shorter than an encrypted envelope.`,
        );
      if (bytes[0] !== 1)
        throw new Error(`Operation ${index + 1} has an unsupported envelope version.`);
      return bytes;
    });
    report.steps[current++] = {
      id: 'envelopes',
      status: 'pass',
      message: 'Every envelope has version 1, a 24-byte nonce and a 16-byte authentication tag.',
    };

    let head = ZERO_HEAD;
    let lastDigest: Hex | undefined;
    for (const [index, envelope] of envelopes.entries()) {
      lastDigest = keccak256(envelope);
      head = nextHead(bundle.wsId, BigInt(index), head, lastDigest);
    }
    if (head.toLowerCase() !== bundle.checkpoint.head.toLowerCase()) {
      throw new Error(
        'The operations do not chain to the head this bundle claims: something was altered, removed or reordered.',
      );
    }
    report.steps[current++] = {
      id: 'head',
      status: 'pass',
      message:
        'Recomputed envelope digests and the ordered head chain match the claimed checkpoint.',
    };

    let native = input.native;
    if (native && !native.nativeApi) {
      ownedNative = await connectNative(native.rpc ?? DEFAULT_NATIVE_RPC);
      native = { ...native, nativeApi: ownedNative };
    }
    const chain = input.chain ?? (await readChain(bundle, rpc, native));
    if (chain.chainId !== bundle.chainId)
      throw new Error(
        `RPC chain id ${chain.chainId} does not match bundle chain id ${bundle.chainId}.`,
      );
    if (chain.registry.toLowerCase() !== bundle.registry.toLowerCase())
      throw new Error('The chain reader registry does not match the bundle registry.');
    const workspace = await chain.getWorkspace(bundle.wsId);
    if (!workspace) throw new Error('This workspace does not exist at the bundle registry.');
    if (workspace.schemaId.toLowerCase() !== bundle.schemaId.toLowerCase())
      throw new Error('The on-chain workspace schema does not match the bundle schema.');
    const count = BigInt(bundle.checkpoint.count);
    if (count === 0n) {
      if (workspace.count === 0n && workspace.head.toLowerCase() !== ZERO_HEAD)
        throw new Error('An empty on-chain workspace must have the zero genesis head.');
    } else if (count <= workspace.count) {
      const event = await chain.getAppended(bundle.wsId, count - 1n);
      if (
        !event ||
        event.wsId.toLowerCase() !== bundle.wsId.toLowerCase() ||
        event.index !== count - 1n ||
        event.head.toLowerCase() !== head ||
        event.digest.toLowerCase() !== lastDigest
      ) {
        throw new Error(
          input.native
            ? `The supplied native block hints and EVM snapshot contain no matching admission at operation ${count}. Missing hints do not prove that the chain never admitted it.`
            : `Portaldot has no matching admission at operation ${count}: this history is not the one that was anchored.`,
        );
      }
    }
    if (count === workspace.count && workspace.head.toLowerCase() !== head)
      throw new Error(
        'The on-chain workspace head contradicts this history at the same operation count.',
      );
    report.steps[current++] = {
      id: 'anchored',
      status: 'pass',
      message:
        count > workspace.count
          ? 'Chain identity, registry and workspace schema match; admission is blocked by the count mismatch checked next.'
          : count === 0n
            ? 'The workspace exists with the matching schema; empty history uses the zero genesis head.'
            : `The registry admission at operation ${count} matches the final digest and checkpoint head.`,
    };

    const missing = workspace.count - count;
    if (missing > 0n)
      throw new Error(
        `This bundle is stale: Portaldot has ${missing} newer ${missing === 1n ? 'operation that is' : 'operations that are'} not in this file.`,
      );
    if (workspace.count < count)
      throw new Error(
        `This bundle claims ${count - workspace.count} operations that Portaldot never admitted.`,
      );
    report.steps[current++] = {
      id: 'complete',
      status: 'pass',
      message: `The bundle contains all ${count} operations admitted at the observed chain state.`,
    };

    if (input.keyError) throw new Error(input.keyError);
    if (input.key === undefined) {
      report.steps[current] = {
        id: 'decrypt',
        status: 'skipped',
        message: 'No key file was supplied; plaintext and journal operations were not checked.',
      };
    } else {
      if (input.key.length !== 32)
        throw new Error('The workspace key must contain exactly 32 bytes.');
      if (bundle.schemaId.toLowerCase() !== journalSchemaId)
        throw new Error('This verifier cannot read an unknown workspace schema.');
      const aad = hexToBytes(bundle.wsId);
      for (const [index, envelope] of envelopes.entries()) {
        let plaintext: Uint8Array;
        try {
          plaintext = xchacha20poly1305(input.key, envelope.subarray(1, 25), aad).decrypt(
            envelope.subarray(25),
          );
        } catch {
          throw new Error(`Operation ${index + 1} cannot be decrypted with this key.`);
        }
        let value: unknown;
        try {
          value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
        } catch {
          throw new Error(`Operation ${index + 1} is not valid UTF-8 JSON.`);
        }
        const op = opSchema.safeParse(value);
        if (!op.success)
          throw new Error(
            `Operation ${index + 1} is not a valid known journal operation: ${op.error.issues[0].path.join('.') || 'type or shape'}.`,
          );
        if (op.data.wsId !== bundle.wsId.toLowerCase())
          throw new Error(`Operation ${index + 1} belongs to another workspace.`);
      }
      report.steps[current] = {
        id: 'decrypt',
        status: 'pass',
        message: `All ${count} operations decrypt, belong to this workspace and have valid known journal types.`,
      };
    }
    report.ok = true;
  } catch (error) {
    report.steps[current] = {
      id: report.steps[current].id,
      status: 'fail',
      message:
        error instanceof Error ? error.message : 'Verification failed with an unknown error.',
    };
  } finally {
    if (ownedNative) await ownedNative.disconnect();
  }
  return report;
}
