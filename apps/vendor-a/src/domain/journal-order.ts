import type { Op } from '@packout/sdk';
import type { Hex } from 'viem';
import type { StoredOp } from '../db/types.ts';

function byTime(a: StoredOp, b: StoredOp): number {
  return a.createdAt - b.createdAt || (a.digest < b.digest ? -1 : 1);
}

/**
 * Journal state is the anchored history in chain order, then what the vendor holds but has not
 * anchored in arrival order, then what only this device knows (including rejected writes, so the
 * author still sees what they wrote and why it did not land).
 */
export function orderForReduction(stored: readonly StoredOp[]): Op[] {
  const anchored = stored
    .filter((op) => op.status === 'anchored' && op.index !== null)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const pending = stored
    .filter((op) => op.status === 'pending')
    .sort((a, b) => (a.apiSeq ?? 0) - (b.apiSeq ?? 0) || byTime(a, b));
  const deviceOnly = stored
    .filter((op) => op.status === 'local' || op.status === 'rejected')
    .sort(byTime);
  const ops: Op[] = [];
  for (const entry of [...anchored, ...pending, ...deviceOnly]) {
    if (entry.op !== null) ops.push(entry.op);
  }
  return ops;
}

/** Anchored envelopes in chain order, and any chain positions this device does not hold. */
export function anchoredEnvelopes(stored: readonly StoredOp[]): {
  envelopes: Hex[];
  missing: number[];
} {
  const byIndex = new Map<number, Hex>();
  for (const op of stored) {
    if (op.status === 'anchored' && op.index !== null) byIndex.set(op.index, op.envelope);
  }
  const indices = [...byIndex.keys()].sort((a, b) => a - b);
  const envelopes: Hex[] = [];
  const missing: number[] = [];
  const last = indices.at(-1) ?? -1;
  for (let index = 0; index <= last; index++) {
    const envelope = byIndex.get(index);
    if (envelope === undefined) missing.push(index);
    else envelopes.push(envelope);
  }
  return { envelopes, missing };
}
