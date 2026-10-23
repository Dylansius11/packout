import { hexToBytes } from 'viem';
import { type Bundle, parseBundle } from './bundle.ts';
import type { ChainReader, WorkspaceOnChain } from './chain-reader.ts';
import { ENVELOPE_VERSION, envelopeDigest, openEnvelope } from './envelope.ts';
import { PackoutError } from './errors.ts';
import { chainHeads, ZERO_HEAD } from './head.ts';
import type { Op } from './op.ts';
import { type JournalState, reduceJournal } from './reducer.ts';

export type StepId = 'format' | 'envelopes' | 'head' | 'anchored' | 'complete' | 'decrypt';
export type StepResult = {
  id: StepId;
  title: string;
  status: 'pass' | 'fail' | 'skipped';
  message: string;
};
export type VerificationReport = {
  ok: boolean;
  steps: StepResult[];
  bundle?: Bundle;
  ops?: Op[];
  state?: JournalState;
  onChain?: WorkspaceOnChain;
};

const STEPS: { id: StepId; title: string }[] = [
  { id: 'format', title: 'Bundle format' },
  { id: 'envelopes', title: 'Encrypted operations' },
  { id: 'head', title: 'History integrity' },
  { id: 'anchored', title: 'Anchored on Portaldot' },
  { id: 'complete', title: 'Complete history' },
  { id: 'decrypt', title: 'Decrypt and read' },
];

export async function verifyBundle(input: {
  bundle: unknown;
  key: Uint8Array;
  chain: ChainReader;
}): Promise<VerificationReport> {
  const steps: StepResult[] = STEPS.map((step) => ({
    ...step,
    status: 'skipped',
    message: 'Not checked because an earlier check failed.',
  }));
  const report: VerificationReport = { ok: false, steps };
  function pass(index: number, message: string): void {
    steps[index].status = 'pass';
    steps[index].message = message;
  }
  function fail(index: number, message: string): VerificationReport {
    steps[index].status = 'fail';
    steps[index].message = message;
    return report;
  }

  let bundle: Bundle;
  try {
    bundle = parseBundle(input.bundle);
  } catch (error) {
    return fail(
      0,
      error instanceof PackoutError ? error.message : 'This file is not a valid PACKOUT bundle v1.',
    );
  }
  report.bundle = bundle;
  pass(0, `This PACKOUT bundle v1 contains ${bundle.checkpoint.count} encrypted operations.`);

  const envelopes = bundle.envelopes.map((envelope) => hexToBytes(envelope));
  for (const [index, envelope] of envelopes.entries()) {
    if (envelope.length < 1 + 24 + 16) {
      return fail(
        1,
        `Operation ${index + 1} is damaged: it is shorter than an encrypted envelope.`,
      );
    }
    if (envelope[0] !== ENVELOPE_VERSION) {
      return fail(1, `Operation ${index + 1} uses an unsupported encrypted-envelope version.`);
    }
  }
  pass(
    1,
    `All ${envelopes.length} encrypted operations have a supported version and complete envelope.`,
  );

  const digests = envelopes.map(envelopeDigest);
  const heads = chainHeads(bundle.wsId, 0n, ZERO_HEAD, digests);
  const head = heads.at(-1) ?? ZERO_HEAD;
  if (head !== bundle.checkpoint.head) {
    return fail(
      2,
      'The operations do not chain to the head this bundle claims: something was altered, removed or reordered.',
    );
  }
  pass(2, `All ${envelopes.length} operations match the ordered history this bundle claims.`);

  const { chain } = input;
  if (chain.chainId !== bundle.chainId) {
    return fail(
      3,
      `This bundle belongs to chain ${bundle.chainId}, but the connected chain is ${chain.chainId}.`,
    );
  }
  if (chain.registry.toLowerCase() !== bundle.registry.toLowerCase()) {
    return fail(
      3,
      'This bundle names a different workspace registry than the connected Portaldot registry.',
    );
  }
  // Reader errors deliberately escape: a failed connection is not a damaged bundle.
  const onChain = await chain.getWorkspace(bundle.wsId);
  if (!onChain)
    return fail(3, 'This workspace does not exist in the connected Portaldot registry.');
  report.onChain = onChain;
  if (onChain.schemaId !== bundle.schemaId) {
    return fail(
      3,
      'The workspace schema on Portaldot differs from the schema named in this bundle.',
    );
  }
  const count = BigInt(bundle.checkpoint.count);
  if (count === 0n) {
    if (head !== ZERO_HEAD || (onChain.count === 0n && onChain.head !== ZERO_HEAD)) {
      return fail(
        3,
        'This empty workspace does not have the required zero history head on Portaldot.',
      );
    }
    pass(
      3,
      'Portaldot confirms the workspace identity; this empty bundle starts at the zero history head.',
    );
  } else if (count <= onChain.count) {
    const event = await chain.getAppended(bundle.wsId, count - 1n);
    if (
      !event ||
      event.wsId !== bundle.wsId ||
      event.index !== count - 1n ||
      event.head !== head ||
      event.digest !== digests.at(-1)
    ) {
      return fail(
        3,
        `Portaldot has no matching history at operation ${count}: this is not the history that was anchored.`,
      );
    }
    pass(3, `Portaldot confirms the history and encrypted content through operation ${count}.`);
  } else {
    // No final event can exist yet; report the exact excess in the completeness step.
    pass(
      3,
      'Portaldot confirms the workspace identity; the number of admitted operations is checked next.',
    );
  }

  if (onChain.count > count) {
    return fail(
      4,
      `This bundle is stale: ${onChain.count - count} operations are missing from this file.`,
    );
  }
  if (onChain.count < count) {
    return fail(
      4,
      `The bundle claims ${count - onChain.count} operations Portaldot never admitted.`,
    );
  }
  pass(4, `This file contains all ${count} operations currently admitted by Portaldot.`);

  if (!(input.key instanceof Uint8Array) || input.key.length !== 32) {
    return fail(5, 'The workspace key must contain exactly 32 bytes.');
  }
  const ops: Op[] = [];
  for (const [index, envelope] of envelopes.entries()) {
    try {
      ops.push(openEnvelope(envelope, input.key, bundle.wsId));
    } catch (error) {
      let reason = 'is not a valid journal operation.';
      if (error instanceof PackoutError) {
        if (error.code === 'decrypt-failed')
          reason = 'cannot be decrypted with this key and workspace.';
        else if (error.code === 'workspace-mismatch') reason = 'belongs to a different workspace.';
        else if (error.code === 'unknown-op-type')
          reason = 'has an operation type this journal cannot read.';
      }
      return fail(5, `Operation ${index + 1} ${reason}`);
    }
  }
  pass(5, `All ${ops.length} operations were decrypted and read as this workspace's journal.`);
  report.ops = ops;
  report.state = reduceJournal(ops);
  report.ok = true;
  return report;
}
