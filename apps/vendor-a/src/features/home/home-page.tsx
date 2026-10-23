import { AnchorSimple, ArrowRight, CloudArrowUp, Laptop, Plus } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { buttonVariants } from '@/components/ui/button';
import { db } from '../../db/db';
import { shortHex } from '../../lib/format';
import { cn } from '../../lib/utils';

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
      <div className="rounded-md border border-dashed border-input px-4 py-6">
        <p className="font-medium">No workspaces on this device yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create one as the owner, or open the invite link a teammate sent you.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface">
      {setups.map((setup) => (
        <li key={setup.salt}>
          <Link
            to="/setup/$salt"
            params={{ salt: setup.salt }}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{setup.label}</span>
              <span className="block text-sm text-warning">
                Setup not finished. Continue where you left off.
              </span>
            </span>
            <ArrowRight size={16} aria-hidden />
          </Link>
        </li>
      ))}
      {workspaces.map((workspace) => (
        <li key={workspace.wsId}>
          <Link
            to="/w/$wsId"
            params={{ wsId: workspace.wsId }}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{workspace.label}</span>
              <span className="block text-sm text-muted-foreground">
                {workspace.role === 'owner' ? 'You own this workspace' : 'You are a member'} ·{' '}
                <code>{shortHex(workspace.wsId)}</code>
              </span>
            </span>
            <ArrowRight size={16} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const LEGEND = [
  {
    Icon: Laptop,
    title: 'On this device',
    text: 'Encrypted and saved here first. It survives a reload.',
  },
  {
    Icon: CloudArrowUp,
    title: 'Sent to vendor',
    text: 'Vendor A holds the encrypted data. It cannot read it.',
  },
  {
    Icon: AnchorSimple,
    title: 'Anchored on Portaldot',
    text: 'Admitted to the workspace history by the chain, with a position and a block.',
  },
] as const;

export function HomePage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="workspaces-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="workspaces-heading" className="text-2xl font-semibold">
            Your workspaces
          </h1>
          <Link to="/new" className={cn(buttonVariants())}>
            <Plus size={16} weight="bold" aria-hidden />
            Create a workspace
          </Link>
        </div>
        <WorkspaceList />
      </section>
      <section aria-labelledby="legend-heading" className="space-y-3">
        <h2 id="legend-heading" className="text-base font-semibold">
          Where your data lives
        </h2>
        <p className="text-sm text-muted-foreground">
          Every change is encrypted on your device before it goes anywhere. Each one shows how far
          it got:
        </p>
        <ol className="space-y-3">
          {LEGEND.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3 text-sm">
              <Icon size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium">{title}.</span>{' '}
                <span className="text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
