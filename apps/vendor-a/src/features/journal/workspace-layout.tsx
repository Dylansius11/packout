import { Link, Outlet } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Avatar } from '@/components/avatar';
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
      <div className="space-y-8">
        <header className="space-y-3 border-b border-border pb-6">
          <h1 className="display break-words text-4xl md:text-5xl">
            <Link
              to="/w/$wsId"
              params={{ wsId: workspace.wsId }}
              className="inline-block rounded-md py-1.5 decoration-border-strong underline-offset-8 hover:underline"
            >
              {workspace.label}
            </Link>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
            <span>
              {workspace.role === 'owner' ? 'You own this workspace' : 'You are a member'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-2">
              writing as
              <Avatar name={workspace.displayName} size="sm" />
              <strong className="font-medium text-foreground">{workspace.displayName}</strong>
            </span>
            <span aria-hidden="true">·</span>
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
      <div className="max-w-2xl space-y-5">
        <h1 className="display text-4xl">Workspace not found</h1>
        <Notice tone="danger" title="This workspace is not on this device">
          Open the invite link you were sent to join it, or go back to your{' '}
          <Link to="/" className="font-medium underline underline-offset-2">
            workspaces
          </Link>
          .
        </Notice>
      </div>
    );
  }
  return <OpenWorkspace workspace={workspace} />;
}
