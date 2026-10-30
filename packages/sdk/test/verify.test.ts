import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes } from '@noble/ciphers/utils.js';
import { type Address, bytesToHex, type Hex, hexToBytes } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  type AppendedEvent,
  type ChainReader,
  chainHeads,
  createBundle,
  createOp,
  envelopeDigest,
  JOURNAL_SCHEMA_ID,
  type Op,
  type StepId,
  sealOp,
  serializeBundle,
  type VerificationReport,
  verifyBundle,
  type WorkspaceOnChain,
  ZERO_HEAD,
} from '../src/index.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const otherWsId: Hex = `0x${'22'.repeat(32)}`;
const registry: Address = '0x1111111111111111111111111111111111111111';
const owner: Address = '0x2222222222222222222222222222222222222222';
const firstId: Hex = `0x${'33'.repeat(16)}`;
const key = new Uint8Array(32).fill(7);
const base = { wsId, author: { memberId: `0x${'44'.repeat(16)}` as Hex, name: 'Dina' }, ts: 100 };
const ops: Op[] = [
  createOp({
    ...base,
    opId: firstId,
    type: 'issue.create',
    body: { title: 'Exit', description: 'Keep our history' },
  }),
  createOp({ ...base, type: 'issue.setStatus', body: { issueId: firstId, status: 'done' } }),
  createOp({ ...base, type: 'comment.add', body: { issueId: firstId, text: 'Still writing' } }),
];
const stepIds: StepId[] = ['format', 'envelopes', 'head', 'anchored', 'complete', 'decrypt'];

class MemoryChain implements ChainReader {
  readonly chainId = 420420777;
  readonly registry = registry;
  workspace: WorkspaceOnChain | null;
  readonly events = new Map<bigint, AppendedEvent>();

  constructor(envelopes: readonly Hex[]) {
    const digests = envelopes.map((envelope) => envelopeDigest(hexToBytes(envelope)));
    const heads = chainHeads(wsId, 0n, ZERO_HEAD, digests);
    this.workspace = {
      owner,
      epoch: 0,
      count: BigInt(envelopes.length),
      head: heads.at(-1) ?? ZERO_HEAD,
      schemaId: JOURNAL_SCHEMA_ID,
    };
    for (const [index, digest] of digests.entries()) {
      this.events.set(BigInt(index), {
        wsId,
        index: BigInt(index),
        author: owner,
        epoch: 0,
        digest,
        head: heads[index],
        blockNumber: 100n + BigInt(index),
        txHash: `0x${'55'.repeat(32)}`,
      });
    }
  }

  async getWorkspace(id: Hex): Promise<WorkspaceOnChain | null> {
    return id === wsId ? this.workspace : null;
  }

  async getAppended(id: Hex, index: bigint): Promise<AppendedEvent | null> {
    return id === wsId ? (this.events.get(index) ?? null) : null;
  }
}

function fixture(envelopes = ops.map((op) => bytesToHex(sealOp(op, key)))) {
  const bundle = createBundle({
    chainId: 420420777,
    registry,
    wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes,
    checkpoint: { blockNumber: 102 },
  });
  return { bundle, chain: new MemoryChain(envelopes) };
}

function expectFailure(report: VerificationReport, id: StepId, message: RegExp) {
  expect(report.ok).toBe(false);
  expect(report.steps.map((step) => step.id)).toEqual(stepIds);
  const failedAt = stepIds.indexOf(id);
  expect(report.steps.map((step) => step.status)).toEqual(
    stepIds.map((_, index) =>
      index < failedAt ? 'pass' : index === failedAt ? 'fail' : 'skipped',
    ),
  );
  expect(report.steps[failedAt].message).toMatch(message);
  expect(report.ops).toBeUndefined();
  expect(report.state).toBeUndefined();
}

describe('bundle verification', () => {
  it('verifies, decrypts and reduces complete anchored history in six ordered steps', async () => {
    const { bundle, chain } = fixture();
    const report = await verifyBundle({ bundle: serializeBundle(bundle), key, chain });
    expect(report.ok).toBe(true);
    expect(report.steps.map((step) => step.id)).toEqual(stepIds);
    expect(report.steps.every((step) => step.status === 'pass')).toBe(true);
    expect(report.bundle).toEqual(bundle);
    expect(report.onChain).toEqual(chain.workspace);
    expect(report.ops).toEqual(ops);
    expect(report.state?.issues[0]).toMatchObject({
      title: 'Exit',
      status: 'done',
      comments: [{ text: 'Still writing' }],
    });
  });

  it('rejects a complete bundle when current state disagrees with its valid final admission', async () => {
    const { bundle, chain } = fixture();
    if (!chain.workspace) throw new Error('Expected a workspace fixture.');
    chain.workspace.head = otherWsId;
    const report = await verifyBundle({ bundle, key, chain });
    expect(report.ok).toBe(false);
    expect(report.steps.find((step) => step.status === 'fail')?.id).toBe('anchored');
    expect(report.ops).toBeUndefined();
  });

  it.each([null, '{', { format: 'packout.bundle/2' }])(
    'reports malformed input %# without throwing',
    async (bundle) => {
      const { chain } = fixture();
      expectFailure(await verifyBundle({ bundle, key, chain }), 'format', /bundle|JSON/i);
    },
  );

  it('catches an omitted envelope at the count check', async () => {
    const { bundle, chain } = fixture();
    bundle.envelopes.pop();
    expectFailure(await verifyBundle({ bundle, key, chain }), 'format', /checkpoint.count/);
  });

  it('catches omitted history even when its claimed count is updated', async () => {
    const { bundle, chain } = fixture();
    bundle.envelopes.splice(1, 1);
    bundle.checkpoint.count = 2;
    expectFailure(await verifyBundle({ bundle, key, chain }), 'head', /altered|removed|reordered/i);
  });

  it.each(['short', 'version'] as const)('reports a damaged envelope: %s', async (kind) => {
    const { bundle, chain } = fixture();
    bundle.envelopes[1] = kind === 'short' ? '0x01' : `0x02${bundle.envelopes[1].slice(4)}`;
    expectFailure(
      await verifyBundle({ bundle, key, chain }),
      'envelopes',
      /Operation 2.*shorter|Operation 2.*version/i,
    );
  });

  it.each(['alter', 'reorder', 'substitute'] as const)(
    'rejects %s tampering at the head check',
    async (kind) => {
      const { bundle, chain } = fixture();
      if (kind === 'alter') {
        const bytes = hexToBytes(bundle.envelopes[1]);
        bytes[25] ^= 1;
        bundle.envelopes[1] = bytesToHex(bytes);
      } else if (kind === 'reorder') {
        [bundle.envelopes[0], bundle.envelopes[1]] = [bundle.envelopes[1], bundle.envelopes[0]];
      } else {
        bundle.envelopes[1] = bytesToHex(sealOp({ ...ops[1], wsId: otherWsId }, key));
      }
      expectFailure(
        await verifyBundle({ bundle, key, chain }),
        'head',
        /altered|removed|reordered/i,
      );
    },
  );

  it('rejects recomputed but never anchored replacement history', async () => {
    const { bundle, chain } = fixture();
    const replacement = fixture([
      bundle.envelopes[2],
      bundle.envelopes[1],
      bundle.envelopes[0],
    ]).bundle;
    expectFailure(
      await verifyBundle({ bundle: replacement, key, chain }),
      'anchored',
      /Portaldot.*operation 3|operation 3.*Portaldot/i,
    );
  });

  it.each(['chainId', 'registry', 'wsId', 'schemaId'] as const)(
    'rejects a mismatched %s before allowing continuation',
    async (field) => {
      const { bundle, chain } = fixture();
      if (field === 'chainId') bundle.chainId = 1;
      if (field === 'registry') bundle.registry = owner;
      if (field === 'wsId') {
        bundle.wsId = otherWsId;
        bundle.checkpoint.head = chainHeads(
          otherWsId,
          0n,
          ZERO_HEAD,
          bundle.envelopes.map((envelope) => envelopeDigest(hexToBytes(envelope))),
        ).at(-1) as Hex;
      }
      if (field === 'schemaId') bundle.schemaId = ZERO_HEAD;
      expectFailure(
        await verifyBundle({ bundle, key, chain }),
        'anchored',
        /chain|registry|workspace|schema/i,
      );
    },
  );

  it.each(['head', 'digest', 'missing', 'workspace', 'index'] as const)(
    'checks the final admission event: %s',
    async (kind) => {
      const { bundle, chain } = fixture();
      const event = chain.events.get(2n) as AppendedEvent;
      if (kind === 'missing') chain.events.delete(2n);
      else if (kind === 'workspace') chain.events.set(2n, { ...event, wsId: otherWsId });
      else if (kind === 'index') chain.events.set(2n, { ...event, index: 1n });
      else chain.events.set(2n, { ...event, [kind]: ZERO_HEAD });
      expectFailure(await verifyBundle({ bundle, key, chain }), 'anchored', /operation 3/i);
    },
  );

  it('reports exactly how many operations a valid older bundle is missing', async () => {
    const { bundle, chain } = fixture();
    const older = fixture(bundle.envelopes.slice(0, 1)).bundle;
    expectFailure(
      await verifyBundle({ bundle: older, key, chain }),
      'complete',
      /stale.*2.*missing|stale.*2 newer operations/i,
    );
  });

  it('reports operations claimed by the bundle but never admitted by the chain', async () => {
    const { bundle } = fixture();
    const chain = new MemoryChain(bundle.envelopes.slice(0, 1));
    expectFailure(
      await verifyBundle({ bundle, key, chain }),
      'complete',
      /claims 2 operations.*never admitted/i,
    );
  });

  it('accepts an empty bundle only for an empty on-chain workspace', async () => {
    const { bundle, chain } = fixture([]);
    const report = await verifyBundle({ bundle, key, chain });
    expect(report.ok).toBe(true);
    expect(report.ops).toEqual([]);
    expect(report.state).toEqual({ issues: [], orphans: [] });
    const populated = fixture().chain;
    expectFailure(await verifyBundle({ bundle, key, chain: populated }), 'complete', /stale.*3/i);
  });

  it('requires a zero on-chain head for an empty workspace', async () => {
    const { bundle, chain } = fixture([]);
    chain.workspace = { ...(chain.workspace as WorkspaceOnChain), head: wsId };
    expectFailure(await verifyBundle({ bundle, key, chain }), 'anchored', /empty|zero|head/i);
  });

  it('reports a wrong key at decryption and names the operation', async () => {
    const { bundle, chain } = fixture();
    expectFailure(
      await verifyBundle({ bundle, key: new Uint8Array(32).fill(8), chain }),
      'decrypt',
      /Operation 1.*key/i,
    );
    expectFailure(
      await verifyBundle({ bundle, key: new Uint8Array(31), chain }),
      'decrypt',
      /key.*32/i,
    );
  });

  it('does not accept an anchored envelope encrypted for another workspace', async () => {
    const { bundle, chain } = fixture([bytesToHex(sealOp({ ...ops[0], wsId: otherWsId }, key))]);
    expectFailure(
      await verifyBundle({ bundle, key, chain }),
      'decrypt',
      /Operation 1.*key|Operation 1.*workspace/i,
    );
  });

  it.each(['unknown-type', 'invalid-op', 'workspace-mismatch'] as const)(
    'reports authenticated %s plaintext at its op index',
    async (kind) => {
      const nonce = new Uint8Array(24).fill(1);
      const value =
        kind === 'unknown-type'
          ? { ...ops[0], type: 'issue.delete' }
          : kind === 'invalid-op'
            ? { ...ops[0], v: 2 }
            : { ...ops[0], wsId: otherWsId };
      const ciphertext = xchacha20poly1305(key, nonce, hexToBytes(wsId)).encrypt(
        new TextEncoder().encode(JSON.stringify(value)),
      );
      const envelope = bytesToHex(concatBytes(new Uint8Array([1]), nonce, ciphertext));
      const { bundle, chain } = fixture([bytesToHex(sealOp(ops[0], key)), envelope]);
      expectFailure(await verifyBundle({ bundle, key, chain }), 'decrypt', /Operation 2/i);
    },
  );

  it.each(['workspace', 'event'] as const)(
    'lets caller-visible network errors propagate during %s reads',
    async (kind) => {
      const { bundle, chain } = fixture();
      const failure = new Error('RPC unavailable');
      const unavailable: ChainReader = {
        chainId: chain.chainId,
        registry,
        getWorkspace:
          kind === 'workspace'
            ? async () => {
                throw failure;
              }
            : chain.getWorkspace.bind(chain),
        getAppended:
          kind === 'event'
            ? async () => {
                throw failure;
              }
            : chain.getAppended.bind(chain),
      };
      await expect(verifyBundle({ bundle, key, chain: unavailable })).rejects.toBe(failure);
    },
  );
});
