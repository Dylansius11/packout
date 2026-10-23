import {
  type AppendedEvent,
  type ChainReader,
  chainHeads,
  createOp,
  envelopeDigest,
  JOURNAL_SCHEMA_ID,
  parseBundle,
  sealOp,
  type WorkspaceOnChain,
  ZERO_HEAD,
} from '@packout/sdk';
import { type Address, bytesToHex, type Hex, hexToBytes } from 'viem';
import { describe, expect, it } from 'vitest';
import { verifyBeforeExport } from '../src/domain/export-bundle.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const registry: Address = '0x1111111111111111111111111111111111111111';
const owner: Address = '0x2222222222222222222222222222222222222222';
const chainId = 31337;
const key = new Uint8Array(32).fill(9);
const author = { memberId: `0x${'44'.repeat(16)}` as Hex, name: 'Dina' };
const issueId: Hex = `0x${'55'.repeat(16)}`;

const ops = [
  createOp({
    wsId,
    author,
    opId: issueId,
    ts: 1,
    type: 'issue.create',
    body: { title: 'Exit', description: '' },
  }),
  createOp({ wsId, author, ts: 2, type: 'issue.setStatus', body: { issueId, status: 'done' } }),
  createOp({ wsId, author, ts: 3, type: 'comment.add', body: { issueId, text: 'Anchored' } }),
];
const envelopes = ops.map((op) => bytesToHex(sealOp(op, key)));

/** A chain that has admitted exactly the given envelopes. */
function chainWith(admitted: readonly Hex[]): ChainReader {
  const digests = admitted.map((envelope) => envelopeDigest(hexToBytes(envelope)));
  const heads = chainHeads(wsId, 0n, ZERO_HEAD, digests);
  const workspace: WorkspaceOnChain = {
    owner,
    epoch: 0,
    count: BigInt(admitted.length),
    head: heads.at(-1) ?? ZERO_HEAD,
    schemaId: JOURNAL_SCHEMA_ID,
  };
  return {
    chainId,
    registry,
    async getWorkspace(id) {
      return id === wsId ? workspace : null;
    },
    async getAppended(id, index): Promise<AppendedEvent | null> {
      const at = Number(index);
      const digest = digests[at];
      const head = heads[at];
      if (id !== wsId || digest === undefined || head === undefined) return null;
      return {
        wsId,
        index,
        author: owner,
        epoch: 0,
        digest,
        head,
        blockNumber: 10n + index,
        txHash: `0x${'66'.repeat(32)}`,
      };
    },
  };
}

const input = { wsId, key, chainId, registry, checkpointBlock: 20 };

describe('export gating', () => {
  it('releases a bundle only after every check passes, and the file holds no key', async () => {
    const result = await verifyBeforeExport({ ...input, chain: chainWith(envelopes), envelopes });
    expect(result.report.ok).toBe(true);
    expect(result.bundleJson).not.toBeNull();
    const bundle = parseBundle(result.bundleJson);
    expect(bundle.envelopes).toEqual(envelopes);
    expect(result.bundleJson).not.toContain(bytesToHex(key).slice(2));
  });

  it('withholds the file when Portaldot has operations this device does not hold', async () => {
    const result = await verifyBeforeExport({
      ...input,
      chain: chainWith(envelopes),
      envelopes: envelopes.slice(0, 2),
    });
    expect(result.bundleJson).toBeNull();
    expect(result.report.ok).toBe(false);
    const failed = result.report.steps.find((step) => step.status === 'fail');
    expect(failed?.id).toBe('complete');
    expect(failed?.message).toMatch(/stale/);
  });

  it('withholds the file when the wrong workspace key is used, naming the failing step', async () => {
    const result = await verifyBeforeExport({
      ...input,
      key: new Uint8Array(32).fill(1),
      chain: chainWith(envelopes),
      envelopes,
    });
    expect(result.bundleJson).toBeNull();
    const failed = result.report.steps.find((step) => step.status === 'fail');
    expect(failed?.id).toBe('decrypt');
    expect(failed?.message).toMatch(/cannot be decrypted/);
  });

  it('withholds the file when the registry on this chain does not know the workspace', async () => {
    const empty: ChainReader = {
      ...chainWith(envelopes),
      async getWorkspace() {
        return null;
      },
    };
    const result = await verifyBeforeExport({ ...input, chain: empty, envelopes });
    expect(result.bundleJson).toBeNull();
    expect(result.report.steps.find((step) => step.status === 'fail')?.message).toMatch(
      /does not exist/,
    );
  });
});
