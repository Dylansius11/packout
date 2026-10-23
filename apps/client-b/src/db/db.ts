import Dexie, { type EntityTable, type Table } from 'dexie';
import type { StoredOp, WorkspaceRecord } from './types.ts';

export type ClientBDb = Dexie & {
  workspaces: EntityTable<WorkspaceRecord, 'wsId'>;
  /** Primary key is `[wsId, index]`. */
  ops: Table<StoredOp, [string, number]>;
};

export const db = new Dexie('packout-client-b') as ClientBDb;

db.version(1).stores({
  workspaces: 'wsId',
  ops: '[wsId+index], wsId',
});
