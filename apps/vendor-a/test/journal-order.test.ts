import { createOp, envelopeDigest, reduceJournal, sealOp } from '@packout/sdk';
import { bytesToHex, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import type { StoredOp } from '../src/db/types.ts';
import { anchoredEnvelopes, orderForReduction } from '../src/domain/journal-order.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const key = new Uint8Array(32).fill(3);
const author = { memberId: `0x${'22'.repeat(16)}` as Hex, name: 'Dina' };
const issueId: Hex = `0x${'33'.repeat(16)}`;

function stored(
  op: ReturnType<typeof createOp>,
  fields: Pick<StoredOp, 'status'> & Partial<StoredOp>,
): StoredOp {
  const envelope = sealOp(op, key);
  return {
    digest: envelopeDigest(envelope),
    wsId,
    envelope: bytesToHex(envelope),
    op,
    origin: 'local',
    createdAt: op.ts,
    statusSince: op.ts,
    apiSeq: null,
    index: null,
    txHash: null,
    blockNumber: null,
    failure: null,
    ...fields,
  };
}

const create = createOp({
  wsId,
  author,
  opId: issueId,
  ts: 10,
  type: 'issue.create',
  body: { title: 'Exit', description: '' },
});
const statusDone = createOp({
  wsId,
  author,
  ts: 20,
  type: 'issue.setStatus',
  body: { issueId, status: 'done' },
});
const statusOpen = createOp({
  wsId,
  author,
  ts: 30,
  type: 'issue.setStatus',
  body: { issueId, status: 'open' },
});
const comment = createOp({
  wsId,
  author,
  ts: 40,
  type: 'comment.add',
  body: { issueId, text: 'hi' },
});

describe('journal state order', () => {
  it('lets the anchored chain order beat arrival and local order', () => {
    // Written locally first, but Portaldot admitted the other status change first.
    const ops = [
      stored(create, { status: 'anchored', index: 0 }),
      stored(statusOpen, { status: 'anchored', index: 1 }),
      stored(statusDone, { status: 'anchored', index: 2 }),
    ];
    const state = reduceJournal(orderForReduction(ops));
    expect(state.issues[0]?.status).toBe('done');
  });

  it('puts what only this device knows after what the vendor holds, and keeps rejected writes visible', () => {
    const ops = [
      stored(comment, { status: 'rejected', failure: 'write access revoked' }),
      stored(statusDone, { status: 'pending', apiSeq: 2 }),
      stored(create, { status: 'anchored', index: 0 }),
    ];
    const ordered = orderForReduction(ops);
    expect(ordered.map((op) => op.type)).toEqual([
      'issue.create',
      'issue.setStatus',
      'comment.add',
    ]);
    expect(reduceJournal(ordered).issues[0]?.comments).toHaveLength(1);
  });

  it('leaves out operations this device cannot decrypt', () => {
    const unreadable: StoredOp = { ...stored(create, { status: 'anchored', index: 0 }), op: null };
    expect(orderForReduction([unreadable])).toEqual([]);
  });
});

describe('anchored envelopes for export', () => {
  it('returns envelopes in chain order and reports positions this device lacks', () => {
    const first = stored(create, { status: 'anchored', index: 0 });
    const third = stored(statusDone, { status: 'anchored', index: 2 });
    const pending = stored(comment, { status: 'pending', apiSeq: 3 });
    const { envelopes, missing } = anchoredEnvelopes([third, pending, first]);
    expect(envelopes).toEqual([first.envelope, third.envelope]);
    expect(missing).toEqual([1]);
  });

  it('is empty when nothing is anchored yet', () => {
    expect(anchoredEnvelopes([stored(create, { status: 'local' })])).toEqual({
      envelopes: [],
      missing: [],
    });
  });
});
