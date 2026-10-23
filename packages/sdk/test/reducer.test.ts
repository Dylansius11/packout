import type { Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import { createOp, type Op, reduceJournal } from '../src/index.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const firstId: Hex = `0x${'22'.repeat(16)}`;
const secondId: Hex = `0x${'33'.repeat(16)}`;
const missingId: Hex = `0x${'44'.repeat(16)}`;
const author = { memberId: `0x${'55'.repeat(16)}` as Hex, name: 'Dina' };
const base = { wsId, author, ts: 100 };
const first = createOp({
  ...base,
  opId: firstId,
  type: 'issue.create',
  body: { title: 'First', description: 'History' },
});
const second = createOp({
  ...base,
  opId: secondId,
  ts: 50,
  type: 'issue.create',
  body: { title: 'Second', description: '' },
});
const status = createOp({
  ...base,
  type: 'issue.setStatus',
  body: { issueId: firstId, status: 'in_progress' },
});
const comment = createOp({
  ...base,
  type: 'comment.add',
  body: { issueId: firstId, text: 'Kept after exit' },
});

describe('journal reducer', () => {
  it('creates issues in anchored order, not timestamp order', () => {
    expect(reduceJournal([first, second])).toEqual({
      issues: [
        {
          id: firstId,
          title: 'First',
          description: 'History',
          status: 'open',
          createdBy: author,
          createdAt: 100,
          comments: [],
        },
        {
          id: secondId,
          title: 'Second',
          description: '',
          status: 'open',
          createdBy: author,
          createdAt: 50,
          comments: [],
        },
      ],
      orphans: [],
    });
  });

  it('applies status updates and comments in anchored order', () => {
    const done = createOp({
      ...base,
      ts: 10,
      type: 'issue.setStatus',
      body: { issueId: firstId, status: 'done' },
    });
    const nextComment = createOp({
      ...base,
      ts: 5,
      type: 'comment.add',
      body: { issueId: firstId, text: 'Still writing' },
    });
    const state = reduceJournal([first, status, comment, done, nextComment]);
    expect(state.issues[0].status).toBe('done');
    expect(state.issues[0].comments).toEqual([
      { opId: comment.opId, text: 'Kept after exit', author, ts: 100 },
      { opId: nextComment.opId, text: 'Still writing', author, ts: 5 },
    ]);
  });

  it('keeps operations for issues never created visible as orphans', () => {
    const orphanStatus = createOp({
      ...base,
      type: 'issue.setStatus',
      body: { issueId: missingId, status: 'done' },
    });
    const orphanComment = createOp({
      ...base,
      type: 'comment.add',
      body: { issueId: missingId, text: 'Do not discard me' },
    });
    const state = reduceJournal([first, orphanStatus, comment, orphanComment]);
    expect(state.orphans).toEqual([orphanStatus, orphanComment]);
    expect(state.issues[0].status).toBe('open');
    expect(state.issues[0].comments).toHaveLength(1);
  });

  it('does not orphan references when their issue is present later in the history', () => {
    const state = reduceJournal([status, comment, first]);
    expect(state.orphans).toEqual([]);
    expect(state.issues[0].status).toBe('in_progress');
    expect(state.issues[0].comments[0].text).toBe('Kept after exit');
  });

  it('is deterministic and never mutates its input operations', () => {
    const ops: readonly Op[] = [first, status, comment, second];
    const before = structuredClone(ops);
    for (const op of ops) {
      Object.freeze(op.author);
      Object.freeze(op.body);
      Object.freeze(op);
    }
    Object.freeze(ops);
    expect(reduceJournal(ops)).toEqual(reduceJournal(ops));
    expect(ops).toEqual(before);
  });

  it('reduces empty history to an empty journal', () => {
    expect(reduceJournal([])).toEqual({ issues: [], orphans: [] });
  });
});
