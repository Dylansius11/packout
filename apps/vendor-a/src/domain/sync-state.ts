import type { Hex } from 'viem';
import type { StoredOp } from '../db/types.ts';

/** Any wait longer than this gets an explicit timeout message (CLAUDE.md section 8). */
export const STALL_MS = 30_000;

export type SyncState =
  | { kind: 'device'; stalled: boolean }
  | { kind: 'vendor'; stalled: boolean }
  | { kind: 'anchored'; index: number; txHash: Hex | null; blockNumber: number | null }
  | { kind: 'rejected'; reason: string };

type SyncFields = Pick<
  StoredOp,
  'status' | 'statusSince' | 'index' | 'txHash' | 'blockNumber' | 'failure'
>;

export function syncStateOf(op: SyncFields, now: number): SyncState {
  const stalled = now - op.statusSince > STALL_MS;
  switch (op.status) {
    case 'local':
      return { kind: 'device', stalled };
    case 'pending':
      return { kind: 'vendor', stalled };
    case 'anchored':
      return {
        kind: 'anchored',
        index: op.index ?? 0,
        txHash: op.txHash,
        blockNumber: op.blockNumber,
      };
    case 'rejected':
      return { kind: 'rejected', reason: op.failure ?? 'write access revoked' };
  }
}

const rank: Record<SyncState['kind'], number> = { rejected: 0, device: 1, vendor: 2, anchored: 3 };

/** What an issue or comment shows when several operations shaped it: the least final one wins. */
export function weakestSyncState(states: readonly SyncState[]): SyncState | null {
  let weakest: SyncState | null = null;
  for (const state of states) {
    if (weakest === null || rank[state.kind] < rank[weakest.kind]) weakest = state;
  }
  return weakest;
}
