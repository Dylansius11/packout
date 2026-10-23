import { Link, Outlet } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Notice } from '@/components/notice';
import { db } from '../../db/db';
import type { WorkspaceRecord } from '../../db/types';
import { shortHex } from '../../lib/format';
import { parseHex32 } from '../../lib/ids';
import { JournalContext } from './journal-context';
import { useJournal } from './use-journal';
import { WorkspaceBanners } from './workspace-banners';

function OpenWorkspace({ workspace }: { workspace: WorkspaceRecord }) {
  const journal = useJournal(workspace);
  return (
    <JournalContext.Provider value={journal}>
      <div className="space-y-6">
        <header className="space-y-1">
          <Link
            to="/w/$wsId"
            params={{ wsId: workspace.wsId }}
            className="break-words text-2xl font-semibold hover:underline"
          >
            {workspace.label}
          </Link>
          <p className="text-sm text-muted-foreground">
            {workspace.role === 'owner' ? 'You own this workspace' : 'You are a member'} · writing
            as <strong className="font-medium text-foreground">{workspace.displayName}</strong> ·{' '}
            <code title={workspace.wsId}>{shortHex(workspace.wsId)}</code>
          </p>
        </header>
        <WorkspaceBanners journal={journal} />
        <Outlet />
      </div>
    </JournalContext.Provider>
  );
}

export function WorkspaceLayout({ wsId }: { wsId: string }) {
  const id = parseHex32(wsId);
  const workspace = useLiveQuery(
    async () => (id ? ((await db.workspaces.get(id)) ?? null) : null),
    [id],
  );
  if (workspace === undefined) {
    return <p className="text-sm text-muted-foreground">Reading this workspace from the device…</p>;
  }
  if (workspace === null) {
    return (
      <Notice tone="danger" title="This workspace is not on this device">
        Open the invite link you were sent to join it, or go back to your{' '}
        <Link to="/" className="underline">
          workspaces
        </Link>
        .
      </Notice>
    );
  }
  return <OpenWorkspace workspace={workspace} />;
}
