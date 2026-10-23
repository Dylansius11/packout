import { describe, expect, it } from 'vitest';
import {
  type AccessEvent,
  buildTimeline,
  currentWriters,
  parseWorkspaceId,
} from '../src/features/proof/history';

const OWNER = '0x00000000000000000000000000000000000000a1';
const VENDOR = '0x00000000000000000000000000000000000000b2';
const HELPER = '0x00000000000000000000000000000000000000c3';
const TX = '0x1111111111111111111111111111111111111111111111111111111111111111';

let log = 0;
function at(blockNumber: number) {
  return { blockNumber: BigInt(blockNumber), logIndex: log++, txHash: TX } as const;
}

describe('current writers', () => {
  it('lists writers granted in epoch 0 and drops one that was revoked', () => {
    const events: AccessEvent[] = [
      { ...at(1), kind: 'created', owner: OWNER, schemaId: TX },
      { ...at(2), kind: 'granted', epoch: 0, writer: VENDOR },
      { ...at(3), kind: 'granted', epoch: 0, writer: HELPER },
      { ...at(4), kind: 'revoked', epoch: 0, writer: VENDOR },
    ];
    expect(currentWriters(events, 0)).toEqual([HELPER]);
  });

  it('forgets everyone from the old epoch when it rotates, then applies later grants', () => {
    const events: AccessEvent[] = [
      { ...at(2), kind: 'granted', epoch: 0, writer: VENDOR },
      { ...at(5), kind: 'rotated', epoch: 1, writers: [] },
      { ...at(6), kind: 'granted', epoch: 1, writer: HELPER },
    ];
    expect(currentWriters(events, 1)).toEqual([HELPER]);
  });

  it('reads the log in chain order whatever order it arrived in', () => {
    const events: AccessEvent[] = [
      { ...at(4), kind: 'revoked', epoch: 0, writer: VENDOR },
      { ...at(2), kind: 'granted', epoch: 0, writer: VENDOR },
    ];
    expect(currentWriters(events, 0)).toEqual([]);
  });
});

describe('access timeline', () => {
  it('shows the vendor losing access at the block of the rotation', () => {
    const events: AccessEvent[] = [
      { ...at(1), kind: 'created', owner: OWNER, schemaId: TX },
      { ...at(2), kind: 'granted', epoch: 0, writer: VENDOR },
      { ...at(9), kind: 'rotated', epoch: 1, writers: [HELPER] },
    ];
    const rotation = buildTimeline(events).at(-1);
    expect(rotation).toMatchObject({ kind: 'rotated', epoch: 1, blockNumber: 9n });
    expect(rotation).toMatchObject({ writers: [HELPER], dropped: [VENDOR] });
  });

  it('does not report a writer as dropped when the new epoch keeps them', () => {
    const events: AccessEvent[] = [
      { ...at(2), kind: 'granted', epoch: 0, writer: VENDOR },
      { ...at(9), kind: 'rotated', epoch: 1, writers: [VENDOR] },
    ];
    expect(buildTimeline(events).at(-1)).toMatchObject({ dropped: [] });
  });
});

describe('workspace id', () => {
  it('accepts 32 bytes of hex in any case and rejects everything else', () => {
    const id = `0x${'AB'.repeat(32)}`;
    expect(parseWorkspaceId(id)).toBe(id.toLowerCase());
    expect(parseWorkspaceId(`0x${'ab'.repeat(31)}`)).toBeNull();
    expect(parseWorkspaceId('not-an-id')).toBeNull();
  });
});
