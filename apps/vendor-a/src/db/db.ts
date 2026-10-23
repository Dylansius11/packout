import Dexie, { type EntityTable } from 'dexie';
import type { SetupRecord, StoredOp, WorkspaceRecord } from './types.ts';

export type VendorADb = Dexie & {
  workspaces: EntityTable<WorkspaceRecord, 'wsId'>;
  setups: EntityTable<SetupRecord, 'salt'>;
  ops: EntityTable<StoredOp, 'digest'>;
};

export const db = new Dexie('packout-vendor-a') as VendorADb;

db.version(1).stores({
  workspaces: 'wsId, role',
  setups: 'salt',
  ops: 'digest, wsId, [wsId+status]',
});
