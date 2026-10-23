import { describe, expect, it } from 'vitest';
import {
  STALL_MS,
  type SyncState,
  syncStateOf,
  weakestSyncState,
} from '../src/domain/sync-state.ts';

const base = {
  statusSince: 1_000,
  index: null,
  txHash: null,
  blockNumber: null,
  failure: null,
} as const;

describe('where an operation lives', () => {
  it('is on this device until the vendor accepts it', () => {
    expect(syncStateOf({ ...base, status: 'local' }, 2_000)).toEqual({
      kind: 'device',
      stalled: false,
    });
  });

  it('is sent to the vendor once accepted, and flags a wait over 30 s instead of pretending', () => {
    expect(syncStateOf({ ...base, status: 'pending' }, 1_000 + STALL_MS)).toEqual({
      kind: 'vendor',
      stalled: false,
    });
    expect(syncStateOf({ ...base, status: 'pending' }, 1_001 + STALL_MS)).toEqual({
      kind: 'vendor',
      stalled: true,
    });
    expect(syncStateOf({ ...base, status: 'local' }, 1_001 + STALL_MS)).toEqual({
      kind: 'device',
      stalled: true,
    });
  });

  it('is anchored with its chain position, transaction and block', () => {
    const state = syncStateOf(
      { ...base, status: 'anchored', index: 4, txHash: `0x${'ab'.repeat(32)}`, blockNumber: 12 },
      9_999_999,
    );
    expect(state).toEqual({
      kind: 'anchored',
      index: 4,
      txHash: `0x${'ab'.repeat(32)}`,
      blockNumber: 12,
    });
  });

  it('is rejected with the reason, defaulting to revoked write access', () => {
    expect(syncStateOf({ ...base, status: 'rejected' }, 2_000)).toEqual({
      kind: 'rejected',
      reason: 'write access revoked',
    });
    expect(syncStateOf({ ...base, status: 'rejected', failure: 'too large' }, 2_000)).toEqual({
      kind: 'rejected',
      reason: 'too large',
    });
  });
});

describe('an issue shaped by several operations', () => {
  const anchored: SyncState = { kind: 'anchored', index: 0, txHash: null, blockNumber: null };
  const vendor: SyncState = { kind: 'vendor', stalled: false };
  const device: SyncState = { kind: 'device', stalled: false };
  const rejected: SyncState = { kind: 'rejected', reason: 'write access revoked' };

  it('shows the least final state', () => {
    expect(weakestSyncState([anchored, vendor, anchored])).toBe(vendor);
    expect(weakestSyncState([anchored, device, vendor])).toBe(device);
    expect(weakestSyncState([anchored, rejected, device])).toBe(rejected);
    expect(weakestSyncState([])).toBeNull();
  });
});
