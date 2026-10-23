import { type JournalState, type OpBody, reduceJournal } from '@packout/sdk';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { createVendorApi } from '../../api/vendor-api';
import { vendorApiUrl } from '../../config/env';
import { db } from '../../db/db';
import type { StoredOp, WorkspaceRecord } from '../../db/types';
import { keyFromBase64Url } from '../../domain/invite';
import { orderForReduction } from '../../domain/journal-order';
import { type SyncState, syncStateOf, weakestSyncState } from '../../domain/sync-state';
import { useNow } from '../../hooks/use-now';
import { type SyncOutcome, syncWorkspace } from '../../sync/engine';
import { writeOp } from '../../sync/write-op';

const POLL_MS = 3000;
const api = createVendorApi(vendorApiUrl);

export type JournalConnection = SyncOutcome | { connection: 'checking' };

export type Journal = {
  workspace: WorkspaceRecord;
  state: JournalState;
  connection: JournalConnection;
  /** Ops this device holds but cannot decrypt. */
  unreadable: number;
  /** Sync state of one operation, by op id, with `now` already applied. */
  syncOf(opId: Hex): SyncState | null;
  /** Weakest sync state across the ops that shaped an issue (creation and status changes). */
  issueSync(issueId: Hex): SyncState | null;
  canWrite: boolean;
  createIssue(title: string, description: string): Promise<Hex>;
  setStatus(
    issueId: Hex,
    status: Extract<OpBody, { type: 'issue.setStatus' }>['body']['status'],
  ): Promise<void>;
  addComment(issueId: Hex, text: string): Promise<void>;
  syncNow(): void;
};

/** Local mirror plus a 3 s sync loop against the vendor. Writes land on the device first, then ride the loop. */
export function useJournal(workspace: WorkspaceRecord): Journal {
  const key = useMemo(() => keyFromBase64Url(workspace.keyB64), [workspace.keyB64]);
  const stored = useLiveQuery(
    () => db.ops.where('wsId').equals(workspace.wsId).toArray(),
    [workspace.wsId],
  );
  const [connection, setConnection] = useState<JournalConnection>({ connection: 'checking' });
  const syncRef = useRef<() => void>(() => {});
  const needsClock = (stored ?? []).some((op) => op.status === 'local' || op.status === 'pending');
  const now = useNow(needsClock);

  // Keep the latest workspace record (for `writerRevoked`) without restarting the loop on every flip.
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  useEffect(() => {
    let stopped = false;
    let running = false;
    let again = false;
    async function pass() {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          const outcome = await syncWorkspace(workspaceRef.current, key, api);
          if (!stopped) setConnection(outcome);
        } while (again && !stopped);
      } finally {
        running = false;
      }
    }
    syncRef.current = () => void pass();
    void pass();
    const timer = setInterval(() => void pass(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [key]);

  const ops: StoredOp[] = stored ?? [];
  const state = useMemo(() => reduceJournal(orderForReduction(ops)), [ops]);
  const unreadable = ops.filter((op) => op.op === null).length;

  const byOpId = useMemo(() => {
    const map = new Map<Hex, StoredOp[]>();
    for (const entry of ops) {
      if (entry.op === null) continue;
      const subject = entry.op.type === 'issue.create' ? entry.op.opId : entry.op.body.issueId;
      map.set(subject, [...(map.get(subject) ?? []), entry]);
    }
    return map;
  }, [ops]);

  const syncOf = useCallback(
    (opId: Hex) => {
      const entry = ops.find((candidate) => candidate.op?.opId === opId);
      return entry ? syncStateOf(entry, now) : null;
    },
    [ops, now],
  );
  const issueSync = useCallback(
    (issueId: Hex) => {
      const shaping = (byOpId.get(issueId) ?? []).filter(
        (entry) => entry.op?.type !== 'comment.add',
      );
      return weakestSyncState(shaping.map((entry) => syncStateOf(entry, now)));
    },
    [byOpId, now],
  );

  async function write(body: OpBody) {
    const op = await writeOp(workspace, key, body);
    syncRef.current();
    return op;
  }

  return {
    workspace,
    state,
    connection,
    unreadable,
    syncOf,
    issueSync,
    canWrite: !workspace.writerRevoked,
    async createIssue(title, description) {
      const op = await write({ type: 'issue.create', body: { title, description } });
      return op.opId;
    },
    async setStatus(issueId, status) {
      await write({ type: 'issue.setStatus', body: { issueId, status } });
    },
    async addComment(issueId, text) {
      await write({ type: 'comment.add', body: { issueId, text } });
    },
    syncNow: () => syncRef.current(),
  };
}
