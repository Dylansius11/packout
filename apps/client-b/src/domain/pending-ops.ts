import type { ChainReader } from '@packout/sdk';
import { db } from '../db/db.ts';

/** A sent transaction that has not shown up on Portaldot by now is treated as never sent. */
export const PENDING_OP_TTL_MS = 10 * 60 * 1000;

/**
 * Settles operations that were sealed and handed to the wallet but never kept, because the tab was
 * closed or the receipt never arrived. One that Portaldot admitted at the next position goes into
 * the history; one it did not admit is dropped once the chain moved on or it is too old to still land.
 * Returns how many operations were recovered.
 */
export async function reconcilePendingOps(
  reader: ChainReader,
  now: number = Date.now(),
): Promise<number> {
  const workspace = await db.workspaces.toCollection().first();
  if (!workspace) return 0;
  const { wsId } = workspace;
  const pending = await db.pendingOps.where('wsId').equals(wsId).toArray();
  if (pending.length === 0) return 0;
  const onChain = await reader.getWorkspace(wsId);
  if (!onChain) return 0;

  let next = await db.ops.where('wsId').equals(wsId).count();
  let recovered = 0;
  while (BigInt(next) < onChain.count) {
    const event = await reader.getAppended(wsId, BigInt(next));
    const match = event && pending.find((item) => item.digest === event.digest);
    if (!event || !match) break;
    const blockNumber = Number(event.blockNumber);
    await db.transaction('rw', db.workspaces, db.ops, db.pendingOps, async () => {
      await db.ops.put({
        wsId,
        index: next,
        digest: match.digest,
        envelope: match.envelope,
        op: match.op,
        origin: 'client-b',
        txHash: event.txHash,
        blockNumber,
        storedAt: now,
      });
      await db.workspaces.update(wsId, {
        checkpointBlock: Math.max(workspace.checkpointBlock, blockNumber),
      });
      await db.pendingOps.delete([wsId, match.digest]);
    });
    next++;
    recovered++;
  }

  const chainMoved = BigInt(next) < onChain.count;
  for (const item of await db.pendingOps.where('wsId').equals(wsId).toArray()) {
    if (chainMoved || now - item.createdAt > PENDING_OP_TTL_MS) {
      await db.pendingOps.delete([wsId, item.digest]);
    }
  }
  return recovered;
}
