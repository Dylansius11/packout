import {
  type Bundle,
  createBundle,
  envelopeDigest,
  JOURNAL_SCHEMA_ID,
  type VerificationReport,
} from '@packout/sdk';
import { bytesToHex, type Hex, hexToBytes } from 'viem';
import { db } from '../db/db.ts';
import type { StoredOp, WorkspaceRecord } from '../db/types.ts';
import { fromBase64Url, toBase64Url } from './key-input.ts';

export type Session = { workspace: WorkspaceRecord; ops: StoredOp[] };

/** The one workspace on this device with its operations in history order, or null. */
export async function loadSession(): Promise<Session | null> {
  const workspace = await db.workspaces.toCollection().first();
  if (!workspace) return null;
  const ops = await db.ops.where('wsId').equals(workspace.wsId).sortBy('index');
  return { workspace, ops };
}

export function sessionKey(workspace: WorkspaceRecord): Uint8Array {
  const key = fromBase64Url(workspace.keyB64);
  if (key === null || key.length !== 32) {
    throw new Error(
      'The workspace key stored on this device is damaged. Forget the workspace and import it again.',
    );
  }
  return key;
}

/** Rebuilds a bundle from what this device holds, so the same verifier that checked the import checks it again. */
export function bundleFromSession(session: Session): Bundle {
  const { workspace, ops } = session;
  return createBundle({
    chainId: workspace.chainId,
    registry: workspace.registry,
    wsId: workspace.wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes: ops.map((stored) => stored.envelope),
    checkpoint: { blockNumber: workspace.checkpointBlock },
  });
}

/**
 * Keeps a verified import on this device, replacing whatever workspace was there. Re-importing the
 * same workspace keeps the member id, display name and takeover record.
 */
export async function saveVerifiedImport(
  report: VerificationReport,
  key: Uint8Array,
): Promise<void> {
  const { bundle, ops } = report;
  if (!report.ok || !bundle || !ops)
    throw new Error('Only a bundle that passed every check can be kept.');
  const now = Date.now();
  await db.transaction('rw', db.workspaces, db.ops, db.pendingOps, async () => {
    const previous = await db.workspaces.get(bundle.wsId);
    await db.workspaces.clear();
    await db.ops.clear();
    await db.pendingOps.where('wsId').notEqual(bundle.wsId).delete();
    await db.workspaces.put({
      wsId: bundle.wsId,
      chainId: bundle.chainId,
      registry: bundle.registry,
      keyB64: toBase64Url(key),
      memberId: previous?.memberId ?? bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
      displayName: previous?.displayName ?? null,
      checkpointBlock: bundle.checkpoint.blockNumber,
      importedAt: now,
      takeover: previous?.takeover ?? null,
    });
    await db.ops.bulkPut(
      bundle.envelopes.map((envelope: Hex, index: number) => ({
        wsId: bundle.wsId,
        index,
        digest: envelopeDigest(hexToBytes(envelope)),
        envelope,
        op: ops[index],
        origin: 'bundle' as const,
        txHash: null,
        blockNumber: null,
        storedAt: now,
      })),
    );
  });
}

export async function forgetWorkspace(): Promise<void> {
  await db.transaction('rw', db.workspaces, db.ops, db.pendingOps, async () => {
    await db.workspaces.clear();
    await db.ops.clear();
    await db.pendingOps.clear();
  });
}
