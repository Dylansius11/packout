import { LockSimple } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { EmptyArt } from '@/components/empty-art';
import { SyncBadge } from '@/components/sync-badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useNow } from '../../hooks/use-now';
import { useRestoreFocusWhenIdle } from '../../lib/focus';
import { formatRelative, formatTime } from '../../lib/format';
import { stagger } from '../../lib/utils';
import { ExportPanel } from '../export/export-panel';
import { IssueStatusLabel } from './issue-status';
import { useJournalContext } from './journal-context';
import { OwnerInvite } from './owner-invite';

/** The write-path explanation shown wherever a person is about to write (CLAUDE.md section 8). */
export function DataLocationNote() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <LockSimple size={14} className="mt-px shrink-0" aria-hidden />
      <span>
        Encrypted on this device first. Then sent to Vendor A as ciphertext it cannot read, and
        anchored on Portaldot.
      </span>
    </p>
  );
}

function NewIssueForm() {
  const journal = useJournalContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  // The submit button disables while it runs, which drops keyboard focus: bring it back to the field.
  useRestoreFocusWhenIdle(busy, titleRef);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await journal.createIssue(title.trim(), description.trim());
      setTitle('');
      setDescription('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-raised"
      aria-label="New issue"
    >
      <h3 className="display text-xl">New issue</h3>
      <div>
        <Label htmlFor="issue-title">Title</Label>
        <Input
          id="issue-title"
          ref={titleRef}
          required
          maxLength={200}
          value={title}
          disabled={!journal.canWrite}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div>
        <Label htmlFor="issue-description">Description</Label>
        <Textarea
          id="issue-description"
          className="min-h-20"
          maxLength={5000}
          value={description}
          disabled={!journal.canWrite}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !journal.canWrite || title.trim() === ''}>
          Create issue
        </Button>
        {journal.canWrite ? null : (
          <span className="text-sm text-danger">
            Writing is turned off: Vendor A no longer has write access.
          </span>
        )}
      </div>
      <DataLocationNote />
    </form>
  );
}

function IssueList() {
  const journal = useJournalContext();
  const now = useNow(true, 30_000);
  const issues = [...journal.state.issues].sort((a, b) => b.createdAt - a.createdAt);
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-xl border border-dashed border-border-strong px-6 py-8 sm:flex-row sm:items-center">
        <EmptyArt className="w-32 shrink-0" />
        <div>
          <p className="display text-xl">No issues yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first one with the form.</p>
        </div>
      </div>
    );
  }
  return (
    <ul
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card"
      aria-label="Issues"
    >
      {issues.map((issue, index) => {
        const sync = journal.issueSync(issue.id);
        const count = issue.comments.length;
        return (
          <li key={issue.id} className="row-in" style={stagger(index)}>
            <Link
              to="/w/$wsId/issues/$issueId"
              params={{ wsId: journal.workspace.wsId, issueId: issue.id }}
              className="group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3.5 gap-y-2 px-4 py-4 transition-colors duration-150 before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:origin-center before:scale-y-0 before:rounded-full before:bg-primary before:transition-transform before:duration-200 hover:bg-background hover:before:scale-y-100 focus-visible:-outline-offset-2 focus-visible:before:scale-y-100 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
            >
              <Avatar name={issue.createdBy.name} className="row-span-1 mt-0.5" />
              <span className="min-w-0">
                <span className="block font-medium leading-snug [overflow-wrap:anywhere]">
                  {issue.title}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                  {issue.createdBy.name} · {count} {count === 1 ? 'comment' : 'comments'} ·{' '}
                  <span title={formatTime(issue.createdAt)}>
                    {formatRelative(issue.createdAt, now)}
                  </span>
                </span>
              </span>
              <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end">
                <IssueStatusLabel status={issue.status} />
                {sync ? <SyncBadge state={sync} /> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function IssuesPage() {
  const journal = useJournalContext();
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
      <section aria-labelledby="issues-heading" className="min-w-0 space-y-6">
        <div className="flex items-baseline gap-3">
          <h2 id="issues-heading" className="display text-3xl">
            Issues
          </h2>
          <span className="tabular text-sm text-muted-foreground">
            {journal.state.issues.length}
          </span>
        </div>
        <NewIssueForm />
        <IssueList />
      </section>
      <aside
        aria-label="Workspace tools"
        className="space-y-8 lg:border-l lg:border-border lg:pl-10"
      >
        {journal.workspace.role === 'owner' ? <OwnerInvite /> : null}
        <ExportPanel />
      </aside>
    </div>
  );
}
