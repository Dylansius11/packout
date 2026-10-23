import { envelopeDigest, openEnvelope } from '@packout/sdk';
import { bytesToHex, type Hex, hexToBytes } from 'viem';
import {
  type EnvelopeItem,
  type VendorApi,
  VendorApiError,
  VendorUnreachableError,
  type WorkspaceView,
} from '../api/vendor-api.ts';
import { db } from '../db/db.ts';
import type { StoredOp, WorkspaceRecord } from '../db/types.ts';

const PAGE_SIZE = 500;
const REVOKED_REASON = 'write access revoked';

export type SyncOutcome =
  | { connection: 'online'; view: WorkspaceView | null }
  | { connection: 'offline' }
  | { connection: 'error'; message: string };

function withItem(op: StoredOp, item: EnvelopeItem, now: number): StoredOp {
  return {
    ...op,
    status: item.status,
    statusSince: op.status === item.status ? op.statusSince : now,
    apiSeq: item.seq,
    index: item.index,
    txHash: item.txHash,
    blockNumber: item.blockNumber,
    failure: item.status === 'rejected' ? REVOKED_REASON : null,
  };
}

async function reject(op: StoredOp, reason: string, now: number): Promise<void> {
  await db.ops.update(op.digest, { status: 'rejected', statusSince: now, failure: reason });
}

/** Sends every envelope the vendor has not acknowledged. Returns true when the vendor refused because its writer was revoked. */
async function flushOutbox(api: VendorApi, wsId: Hex, now: number): Promise<boolean> {
  const unsent = (await db.ops.where('[wsId+status]').equals([wsId, 'local']).toArray()).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  for (const [position, op] of unsent.entries()) {
    try {
      const item = await api.postEnvelope(wsId, op.envelope);
      await db.ops.put(withItem(op, item, now));
    } catch (error) {
      if (!(error instanceof VendorApiError) || error.status >= 500) throw error;
      if (error.code === 'writer-revoked') {
        for (const rest of unsent.slice(position)) await reject(rest, REVOKED_REASON, now);
        return true;
      }
      await reject(op, error.message, now);
    }
  }
  return false;
}

async function ingest(wsId: Hex, key: Uint8Array, item: EnvelopeItem, now: number): Promise<void> {
  const envelope = hexToBytes(item.envelope);
  // The vendor's digest is not trusted: identity is what this device computes from the bytes.
  const digest = envelopeDigest(envelope);
  const existing = await db.ops.get(digest);
  if (existing) {
    await db.ops.put(withItem(existing, item, now));
    return;
  }
  let op: StoredOp['op'] = null;
  let failure: string | null = null;
  try {
    op = openEnvelope(envelope, key, wsId);
  } catch {
    failure = 'This device cannot read this operation with the workspace key.';
  }
  await db.ops.put(
    withItem(
      {
        digest,
        wsId,
        envelope: bytesToHex(envelope),
        op,
        origin: 'remote',
        createdAt: op?.ts ?? Date.parse(item.receivedAt),
        status: item.status,
        statusSince: now,
        apiSeq: null,
        index: null,
        txHash: null,
        blockNumber: null,
        failure,
      },
      item,
      now,
    ),
  );
}

/** Re-reads from the oldest envelope that is not final, so status changes of earlier ops are seen. */
async function pullEnvelopes(
  api: VendorApi,
  wsId: Hex,
  key: Uint8Array,
  now: number,
  from?: number,
): Promise<void> {
  const known = (await db.ops.where('wsId').equals(wsId).toArray()).filter(
    (op) => op.apiSeq !== null,
  );
  const unfinished = known.filter((op) => op.status === 'pending').map((op) => op.apiSeq ?? 0);
  let after =
    from ??
    (unfinished.length > 0
      ? Math.min(...unfinished) - 1
      : Math.max(0, ...known.map((op) => op.apiSeq ?? 0)));
  for (;;) {
    const page = await api.listEnvelopes(wsId, after, PAGE_SIZE);
    for (const item of page.items) await ingest(wsId, key, item, now);
    if (page.items.length < PAGE_SIZE) return;
    after = page.nextAfter;
  }
}

/** One sync pass: resend unsent ops, pull everyone's ops, learn whether the vendor can still write. */
export async function syncWorkspace(
  workspace: WorkspaceRecord,
  key: Uint8Array,
  api: VendorApi,
  options: { fullPull?: boolean } = {},
): Promise<SyncOutcome> {
  const now = Date.now();
  try {
    const view = await api.getWorkspace(workspace.wsId);
    if (view === null) return { connection: 'online', view: null };
    const revokedByFlush = await flushOutbox(api, workspace.wsId, now);
    await pullEnvelopes(api, workspace.wsId, key, now, options.fullPull ? 0 : undefined);
    const revoked = revokedByFlush || view.writerState === 'revoked';
    if (revoked !== workspace.writerRevoked) {
      await db.workspaces.update(workspace.wsId, { writerRevoked: revoked });
    }
    return {
      connection: 'online',
      view: revokedByFlush ? { ...view, writerState: 'revoked' } : view,
    };
  } catch (error) {
    if (error instanceof VendorUnreachableError) return { connection: 'offline' };
    if (error instanceof VendorApiError) return { connection: 'error', message: error.message };
    throw error;
  }
}
