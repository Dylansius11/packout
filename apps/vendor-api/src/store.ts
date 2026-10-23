import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { type AppendedEvent, envelopeDigest } from '@packout/sdk';
import { type Address, type Hex, hexToBytes } from 'viem';
import { z } from 'zod';

export type WorkspaceView = {
  wsId: Hex;
  writer: Address;
  writerState: 'active' | 'revoked';
  pending: number;
  anchoredCount: number;
  chainCount: number;
  lastError: string | null;
};
export type EnvelopeItem = {
  seq: number;
  digest: Hex;
  envelope: Hex;
  status: 'pending' | 'anchored' | 'rejected';
  index: number | null;
  txHash: Hex | null;
  blockNumber: number | null;
  receivedAt: string;
};
export class StoreError extends Error {
  constructor(
    readonly code: 'unknown-workspace' | 'writer-revoked',
    message: string,
  ) {
    super(message);
  }
}

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new RangeError('Chain position exceeds the API safe integer range.');
  return number;
}
const hex = z
  .string()
  .regex(/^0x[0-9a-f]*$/)
  .transform((value): Hex => value as Hex);
const itemSchema = z.object({
  seq: z.int().positive(),
  digest: hex,
  envelope: hex,
  status: z.enum(['pending', 'anchored', 'rejected']),
  index: z.int().nonnegative().nullable(),
  txHash: hex.nullable(),
  blockNumber: z.int().nonnegative().nullable(),
  receivedAt: z.string(),
});
const workspaceSchema = z.object({
  wsId: hex,
  writer: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((value): Address => value as Address),
  writerState: z.enum(['active', 'revoked']),
  pending: z.int().nonnegative(),
  anchoredCount: z.int().nonnegative(),
  chainCount: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => safeNumber(BigInt(value))),
  lastError: z.string().nullable(),
});
const itemColumns =
  'seq, digest, envelope, status, chain_index AS "index", tx_hash AS txHash, block_number AS blockNumber, received_at AS receivedAt';
const workspaceSelect = `SELECT w.ws_id AS wsId, w.writer, w.writer_state AS writerState,
  w.chain_count AS chainCount, w.last_error AS lastError,
  (SELECT COUNT(*) FROM envelopes e WHERE e.ws_id = w.ws_id AND e.status = 'pending') AS pending,
  (SELECT COUNT(*) FROM envelopes e WHERE e.ws_id = w.ws_id AND e.status = 'anchored') AS anchoredCount
  FROM workspaces w`;

export class EnvelopeStore {
  private readonly db: DatabaseSync;
  private readonly sql;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS workspaces (
        ws_id TEXT PRIMARY KEY, writer TEXT NOT NULL,
        writer_state TEXT NOT NULL DEFAULT 'active' CHECK(writer_state IN ('active', 'revoked')),
        chain_count TEXT NOT NULL, last_error TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS envelopes (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        ws_id TEXT NOT NULL REFERENCES workspaces(ws_id), digest TEXT NOT NULL, envelope TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'anchored', 'rejected')),
        chain_index INTEGER, tx_hash TEXT, block_number INTEGER, received_at TEXT NOT NULL,
        UNIQUE(ws_id, digest)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS envelopes_queue ON envelopes(ws_id, status, seq);`);
    this.sql = {
      workspace: this.db.prepare(`${workspaceSelect} WHERE w.ws_id = ?`),
      workspaces: this.db.prepare(`${workspaceSelect} ORDER BY w.ws_id`),
      register: this.db.prepare(
        'INSERT INTO workspaces(ws_id, writer, chain_count) VALUES (?, ?, ?) ON CONFLICT(ws_id) DO NOTHING',
      ),
      item: this.db.prepare(`SELECT ${itemColumns} FROM envelopes WHERE ws_id = ? AND digest = ?`),
      submit: this.db.prepare(
        'INSERT INTO envelopes(ws_id, digest, envelope, received_at) VALUES (?, ?, ?, ?)',
      ),
      list: this.db.prepare(
        `SELECT ${itemColumns} FROM envelopes WHERE ws_id = ? AND seq > ? ORDER BY seq LIMIT ?`,
      ),
      pending: this.db.prepare(
        `SELECT ${itemColumns} FROM envelopes WHERE ws_id = ? AND status = 'pending' ORDER BY seq LIMIT 64`,
      ),
      submitted: this.db.prepare(
        "UPDATE envelopes SET tx_hash = ? WHERE ws_id = ? AND digest = ? AND status = 'pending'",
      ),
      submittedPending: this.db.prepare(
        `SELECT ${itemColumns} FROM envelopes WHERE ws_id = ? AND status = 'pending' AND tx_hash IS NOT NULL ORDER BY seq`,
      ),
      clearSubmitted: this.db.prepare(
        "UPDATE envelopes SET tx_hash = NULL WHERE ws_id = ? AND tx_hash = ? AND status = 'pending'",
      ),
      anchored: this.db.prepare(
        "UPDATE envelopes SET status = 'anchored', chain_index = ?, tx_hash = ?, block_number = ? WHERE ws_id = ? AND digest = ? AND status = 'pending'",
      ),
      checkpoint: this.db.prepare('UPDATE workspaces SET chain_count = ? WHERE ws_id = ?'),
      error: this.db.prepare('UPDATE workspaces SET last_error = ? WHERE ws_id = ?'),
      revoked: this.db.prepare(
        "UPDATE workspaces SET writer_state = 'revoked', last_error = ? WHERE ws_id = ?",
      ),
      reject: this.db.prepare(
        "UPDATE envelopes SET status = 'rejected' WHERE ws_id = ? AND status = 'pending'",
      ),
    };
  }

  private transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getWorkspace(wsId: Hex): WorkspaceView | null {
    const row = this.sql.workspace.get(wsId);
    return row ? workspaceSchema.parse(row) : null;
  }

  listWorkspaces(): WorkspaceView[] {
    return this.sql.workspaces.all().map((row) => workspaceSchema.parse(row));
  }

  registerWorkspace(
    wsId: Hex,
    writer: Address,
    chainCount: bigint,
  ): { workspace: WorkspaceView; created: boolean } {
    safeNumber(chainCount);
    return this.transaction(() => {
      const inserted = this.sql.register.run(wsId, writer, chainCount.toString());
      const workspace = this.getWorkspace(wsId);
      if (!workspace) throw new Error('Workspace registration was not persisted.');
      return { workspace, created: Number(inserted.changes) === 1 };
    });
  }

  submitEnvelope(wsId: Hex, envelope: Hex): { item: EnvelopeItem; created: boolean } {
    const digest = envelopeDigest(hexToBytes(envelope));
    return this.transaction(() => {
      const workspace = this.getWorkspace(wsId);
      if (!workspace)
        throw new StoreError(
          'unknown-workspace',
          'This workspace is not registered with Vendor A.',
        );
      if (workspace.writerState === 'revoked')
        throw new StoreError(
          'writer-revoked',
          workspace.lastError ?? 'Write access revoked by the workspace owner.',
        );
      const existing = this.sql.item.get(wsId, digest);
      if (existing) return { item: itemSchema.parse(existing), created: false };
      this.sql.submit.run(wsId, digest, envelope, new Date().toISOString());
      return { item: itemSchema.parse(this.sql.item.get(wsId, digest)), created: true };
    });
  }

  listEnvelopes(wsId: Hex, after: number, limit: number): EnvelopeItem[] {
    return this.sql.list.all(wsId, after, limit).map((row) => itemSchema.parse(row));
  }

  pendingEnvelopes(wsId: Hex): EnvelopeItem[] {
    return this.sql.pending.all(wsId).map((row) => itemSchema.parse(row));
  }

  markSubmitted(wsId: Hex, digests: readonly Hex[], hash: Hex): void {
    this.transaction(() => {
      for (const digest of digests) this.sql.submitted.run(hash, wsId, digest);
    });
  }

  submittedBatches(wsId: Hex): { hash: Hex; digests: Hex[] }[] {
    const groups = new Map<Hex, Hex[]>();
    for (const row of this.sql.submittedPending.all(wsId)) {
      const item = itemSchema.parse(row);
      if (item.txHash === null)
        throw new Error('Submitted envelope is missing its transaction hash.');
      const digests = groups.get(item.txHash);
      if (digests) digests.push(item.digest);
      else groups.set(item.txHash, [item.digest]);
    }
    return Array.from(groups, ([hash, digests]) => ({ hash, digests }));
  }

  clearSubmitted(wsId: Hex, hash: Hex): void {
    this.transaction(() => {
      this.sql.clearSubmitted.run(wsId, hash);
    });
  }

  setChainCount(wsId: Hex, count: bigint): void {
    safeNumber(count);
    this.transaction(() => {
      this.sql.checkpoint.run(count.toString(), wsId);
    });
  }

  markAnchored(wsId: Hex, digests: readonly Hex[], events: readonly AppendedEvent[]): void {
    const byDigest = new Map(
      events.filter((event) => event.wsId === wsId).map((event) => [event.digest, event]),
    );
    const selected = digests.map((digest) => {
      const event = byDigest.get(digest);
      if (!event) throw new Error(`Appended event missing for digest ${digest}.`);
      return {
        ...event,
        index: safeNumber(event.index),
        blockNumber: safeNumber(event.blockNumber),
      };
    });
    this.transaction(() => {
      const workspace = this.getWorkspace(wsId);
      if (!workspace)
        throw new StoreError(
          'unknown-workspace',
          'This workspace is not registered with Vendor A.',
        );
      let count = BigInt(workspace.chainCount);
      for (const event of selected) {
        this.sql.anchored.run(event.index, event.txHash, event.blockNumber, wsId, event.digest);
        if (BigInt(event.index) >= count) count = BigInt(event.index) + 1n;
      }
      safeNumber(count);
      this.sql.checkpoint.run(count.toString(), wsId);
      this.sql.error.run(null, wsId);
    });
  }

  setLastError(wsId: Hex, message: string): void {
    this.transaction(() => {
      this.sql.error.run(message, wsId);
    });
  }

  markRevoked(wsId: Hex, message: string): void {
    this.transaction(() => {
      this.sql.revoked.run(message, wsId);
      this.sql.reject.run(wsId);
    });
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }
}
