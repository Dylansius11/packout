import 'fake-indexeddb/auto';
import {
  type AppendedEvent,
  type ChainReader,
  createOp,
  JOURNAL_SCHEMA_ID,
  sealOp,
} from '@packout/sdk';
import type { Address, Hex } from 'viem';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db.ts';
import type { PendingOp, WorkspaceRecord } from '../src/db/types.ts';
import { PENDING_OP_TTL_MS, reconcilePendingOps } from '../src/domain/pending-ops.ts';

const wsId: Hex = `0x${'4c'.repeat(32)}`;
const registry = `0x${'a7'.repeat(20)}` as Address;
const txHash: Hex = `0x${'ee'.repeat(32)}`;
const head: Hex = `0x${'11'.repeat(32)}`;

const workspace: WorkspaceRecord = {
  wsId,
  chainId: 1,
  registry,
  keyB64: 'k',
  memberId: `0x${'01'.repeat(16)}`,
  displayName: 'Owner',
  checkpointBlock: 10,
  importedAt: 0,
  takeover: null,
};

function pendingOp(createdAt: number): PendingOp {
  const op = createOp({
    wsId,
    author: { memberId: workspace.memberId, name: 'Owner' },
    type: 'issue.create',
    body: { title: 'Write while refreshing', description: '' },
  });
  const envelope = sealOp(op, new Uint8Array(32).fill(7));
  return {
    wsId,
    digest: `0x${Buffer.from(envelope.slice(0, 32)).toString('hex')}`,
    envelope: `0x${Buffer.from(envelope).toString('hex')}`,
    op,
    createdAt,
  };
}

function chainAt(count: bigint, events: Record<number, Partial<AppendedEvent>>): ChainReader {
  return {
    chainId: 1,
    registry,
    async getWorkspace() {
      return { owner: registry, epoch: 1, count, head, schemaId: JOURNAL_SCHEMA_ID };
    },
    async getAppended(_ws, index) {
      const event = events[Number(index)];
      return event
        ? ({ wsId, index, author: registry, epoch: 1, head, ...event } as AppendedEvent)
        : null;
    },
  };
}

async function deviceHoldsOps(count: number) {
  for (let index = 0; index < count; index++) {
    await db.ops.put({
      wsId,
      index,
      digest: `0x${String(index).padStart(64, '0')}`,
      envelope: '0x00',
      op: pendingOp(0).op,
      origin: 'bundle',
      txHash: null,
      blockNumber: null,
      storedAt: 0,
    });
  }
}

beforeEach(async () => {
  await Promise.all([db.workspaces.clear(), db.ops.clear(), db.pendingOps.clear()]);
  await db.workspaces.put(workspace);
});

describe('a write whose tab closed before the receipt arrived', () => {
  it('is taken back into the history when Portaldot admitted it at the next position', async () => {
    await deviceHoldsOps(4);
    const pending = pendingOp(Date.now());
    await db.pendingOps.put(pending);

    const recovered = await reconcilePendingOps(
      chainAt(5n, { 4: { digest: pending.digest, txHash, blockNumber: 42n } }),
    );

    expect(recovered).toBe(1);
    const stored = await db.ops.get([wsId, 4]);
    expect(stored).toMatchObject({
      digest: pending.digest,
      origin: 'client-b',
      txHash,
      blockNumber: 42,
    });
    expect(await db.pendingOps.count()).toBe(0);
    expect((await db.workspaces.get(wsId))?.checkpointBlock).toBe(42);
  });

  it('is kept while Portaldot has not admitted it and it may still land', async () => {
    await deviceHoldsOps(4);
    await db.pendingOps.put(pendingOp(Date.now()));

    expect(await reconcilePendingOps(chainAt(4n, {}))).toBe(0);
    expect(await db.pendingOps.count()).toBe(1);
    expect(await db.ops.count()).toBe(4);
  });

  it('is dropped once it is too old to still land', async () => {
    await deviceHoldsOps(4);
    await db.pendingOps.put(pendingOp(Date.now() - PENDING_OP_TTL_MS - 1));

    await reconcilePendingOps(chainAt(4n, {}));
    expect(await db.pendingOps.count()).toBe(0);
  });

  it("is dropped, not adopted, when the next position holds someone else's operation", async () => {
    await deviceHoldsOps(4);
    await db.pendingOps.put(pendingOp(Date.now()));

    const recovered = await reconcilePendingOps(
      chainAt(5n, { 4: { digest: `0x${'ff'.repeat(32)}` } }),
    );

    expect(recovered).toBe(0);
    expect(await db.pendingOps.count()).toBe(0);
    expect(await db.ops.count()).toBe(4);
  });
});
