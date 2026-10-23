import type { Address, Hex } from 'viem';

/** Where a registry event sits on the chain; (block, log index) is the order Portaldot admitted them in. */
export type EventPosition = { blockNumber: bigint; logIndex: number; txHash: Hex };

/** The registry events that change who may write to a workspace. */
export type AccessEvent = EventPosition &
  (
    | { kind: 'created'; owner: Address; schemaId: Hex }
    | { kind: 'granted'; epoch: number; writer: Address }
    | { kind: 'revoked'; epoch: number; writer: Address }
    | { kind: 'rotated'; epoch: number; writers: readonly Address[] }
  );

export type TimelineEntry = EventPosition &
  (
    | { kind: 'created'; owner: Address }
    | { kind: 'granted'; epoch: number; writer: Address }
    | { kind: 'revoked'; epoch: number; writer: Address }
    | {
        kind: 'rotated';
        epoch: number;
        /** Writers authorized when the epoch began. */
        writers: readonly Address[];
        /** Writers of the previous epoch who lost access when it ended. */
        dropped: readonly Address[];
      }
  );

const WORKSPACE_ID = /^0x[0-9a-fA-F]{64}$/;

/** A workspace id is a 32-byte hex string; anything else cannot name a workspace. */
export function parseWorkspaceId(text: string): Hex | null {
  return WORKSPACE_ID.test(text) ? (text.toLowerCase() as Hex) : null;
}

export function byPosition(a: EventPosition, b: EventPosition): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return a.logIndex - b.logIndex;
}

type Epochs = Map<number, Map<string, Address>>;

function writersOf(epochs: Epochs, epoch: number): Map<string, Address> {
  let writers = epochs.get(epoch);
  if (!writers) {
    writers = new Map();
    epochs.set(epoch, writers);
  }
  return writers;
}

/** Replays the access events in chain order. Returns the timeline and the writers of every epoch. */
function replay(events: readonly AccessEvent[]): { timeline: TimelineEntry[]; epochs: Epochs } {
  const epochs: Epochs = new Map();
  const timeline: TimelineEntry[] = [];
  for (const event of [...events].sort(byPosition)) {
    const position = {
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      txHash: event.txHash,
    };
    if (event.kind === 'created') {
      timeline.push({ ...position, kind: 'created', owner: event.owner });
    } else if (event.kind === 'granted') {
      writersOf(epochs, event.epoch).set(event.writer.toLowerCase(), event.writer);
      timeline.push({ ...position, kind: 'granted', epoch: event.epoch, writer: event.writer });
    } else if (event.kind === 'revoked') {
      writersOf(epochs, event.epoch).delete(event.writer.toLowerCase());
      timeline.push({ ...position, kind: 'revoked', epoch: event.epoch, writer: event.writer });
    } else {
      const before = epochs.get(event.epoch - 1) ?? new Map<string, Address>();
      const after = new Map(event.writers.map((writer) => [writer.toLowerCase(), writer]));
      epochs.set(event.epoch, after);
      timeline.push({
        ...position,
        kind: 'rotated',
        epoch: event.epoch,
        writers: [...after.values()],
        dropped: [...before].filter(([key]) => !after.has(key)).map(([, writer]) => writer),
      });
    }
  }
  return { timeline, epochs };
}

/** Everything that changed who may write, oldest first, with who lost access at each rotation. */
export function buildTimeline(events: readonly AccessEvent[]): TimelineEntry[] {
  return replay(events).timeline;
}

/**
 * Writers authorized in `epoch`, besides the owner who can always write: the writers the epoch
 * began with, plus later grants, minus later revocations within the same epoch.
 */
export function currentWriters(events: readonly AccessEvent[], epoch: number): Address[] {
  return [...(replay(events).epochs.get(epoch)?.values() ?? [])];
}
