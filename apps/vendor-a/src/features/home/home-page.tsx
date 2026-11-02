import { ArrowRight, Plus } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { DataPath } from '@/components/data-path';
import { EmptyArt } from '@/components/empty-art';
import { buttonVariants } from '@/components/ui/button';
import { db } from '../../db/db';
import { shortHex } from '../../lib/format';
import { cn, stagger } from '../../lib/utils';

const rowLink =
  'group relative flex min-h-16 items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-background focus-visible:-outline-offset-2 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:origin-center before:scale-y-0 before:rounded-full before:bg-primary before:transition-transform before:duration-200 hover:before:scale-y-100 focus-visible:before:scale-y-100';

function Monogram({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="display flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-background text-lg"
    >
      {Array.from(label.trim())[0]?.toUpperCase() ?? '·'}
    </span>
  );
}

function WorkspaceList() {
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('wsId').toArray(), []);
  const setups = useLiveQuery(async () => {
    const all = await db.setups.toArray();
    const finished = new Set((await db.workspaces.toArray()).map((workspace) => workspace.wsId));
    return all.filter((setup) => setup.wsId === null || !finished.has(setup.wsId));
  }, []);

  if (workspaces === undefined || setups === undefined) {
    return (
      <p className="text-sm text-muted-foreground">Reading workspaces stored on this device…</p>
    );
  }
  if (workspaces.length === 0 && setups.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-xl border border-dashed border-border-strong px-6 py-8 sm:flex-row sm:items-center">
        <EmptyArt className="w-36 shrink-0" />
        <div>
          <p className="display text-xl">No workspaces on this device yet.</p>
          <p className="mt-1.5 max-w-[42ch] text-sm text-muted-foreground">
            Create one as the owner, or open the invite link a teammate sent you.
          </p>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      {setups.map((setup, index) => (
        <li key={setup.salt} className="row-in" style={stagger(index)}>
          <Link to="/setup/$salt" params={{ salt: setup.salt }} className={rowLink}>
            <Monogram label={setup.label} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{setup.label}</span>
              <span className="block text-sm text-warning">
                Setup not finished. Continue where you left off.
              </span>
            </span>
            <ArrowRight
              size={16}
              className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </li>
      ))}
      {workspaces.map((workspace, index) => (
        <li key={workspace.wsId} className="row-in" style={stagger(index + setups.length)}>
          <Link to="/w/$wsId" params={{ wsId: workspace.wsId }} className={rowLink}>
            <Monogram label={workspace.label} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{workspace.label}</span>
              <span className="block text-sm text-muted-foreground">
                {workspace.role === 'owner' ? 'You own this workspace' : 'You are a member'} ·{' '}
                <code>{shortHex(workspace.wsId)}</code>
              </span>
            </span>
            <ArrowRight
              size={16}
              className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-20">
      <section aria-labelledby="workspaces-heading" className="min-w-0 space-y-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 id="workspaces-heading" className="display text-4xl md:text-5xl">
              Your workspaces
            </h1>
            <p className="max-w-[44ch] text-muted-foreground">
              Issues your team writes down, kept encrypted and anchored where no vendor can rewrite
              them.
            </p>
          </div>
          <Link to="/new" className={cn(buttonVariants(), 'self-start sm:self-auto')}>
            <Plus size={16} weight="bold" aria-hidden />
            Create a workspace
          </Link>
        </div>
        <WorkspaceList />
      </section>
      <aside className="lg:border-l lg:border-border lg:pl-10">
        <DataPath headingId="legend-heading" />
      </aside>
    </div>
  );
}
