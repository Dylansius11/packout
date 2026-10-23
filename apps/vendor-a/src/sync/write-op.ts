import { createOp, envelopeDigest, type Op, type OpBody, sealOp } from '@packout/sdk';
import { bytesToHex } from 'viem';
import { db } from '../db/db.ts';
import type { WorkspaceRecord } from '../db/types.ts';

/**
 * Encrypts one change on this device and keeps it in the local mirror. It is sent to the vendor
 * by the next sync pass; until then it is honestly "on this device" and survives a reload.
 */
export async function writeOp(
  workspace: WorkspaceRecord,
  key: Uint8Array,
  body: OpBody,
): Promise<Op> {
  const op = createOp({
    wsId: workspace.wsId,
    author: { memberId: workspace.memberId, name: workspace.displayName },
    ...body,
  });
  const envelope = sealOp(op, key);
  const now = Date.now();
  await db.ops.add({
    digest: envelopeDigest(envelope),
    wsId: workspace.wsId,
    envelope: bytesToHex(envelope),
    op,
    origin: 'local',
    createdAt: now,
    status: 'local',
    statusSince: now,
    apiSeq: null,
    index: null,
    txHash: null,
    blockNumber: null,
    failure: null,
  });
  return op;
}
