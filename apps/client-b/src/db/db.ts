import Dexie, { type EntityTable, type Table } from 'dexie';
import type { PendingOp, StoredOp, WorkspaceRecord } from './types.ts';

export type ClientBDb = Dexie & {
  workspaces: EntityTable<WorkspaceRecord, 'wsId'>;
  /** Primary key is `[wsId, index]`. */
  ops: Table<StoredOp, [string, number]>;
  /** Primary key is `[wsId+digest]`. Sent, or about to be sent, and not yet kept as an operation. */
  pendingOps: Table<PendingOp, [string, string]>;
};

export const db = new Dexie('packout-client-b') as ClientBDb;

db.version(1).stores({
  workspaces: 'wsId',
  ops: '[wsId+index], wsId',
});

db.version(2).stores({
  workspaces: 'wsId',
  ops: '[wsId+index], wsId',
  pendingOps: '[wsId+digest], wsId',
});
