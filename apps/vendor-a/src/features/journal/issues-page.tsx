import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { SyncBadge } from '@/components/sync-badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { ExportPanel } from '../export/export-panel';
import { IssueStatusLabel } from './issue-status';
import { useJournalContext } from './journal-context';
import { OwnerInvite } from './owner-invite';

/** The write-path explanation shown wherever a person is about to write (CLAUDE.md section 8). */
export function DataLocationNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Encrypted on this device first. Then sent to Vendor A as ciphertext it cannot read, and
      anchored on Portaldot.
    </p>
  );
}

function NewIssueForm() {
  const journal = useJournalContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

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
      className="space-y-3 rounded-md border border-border bg-surface p-4"
      aria-label="New issue"
    >
      <h2 className="text-base font-semibold">New issue</h2>
      <div>
        <Label htmlFor="issue-title">Title</Label>
        <Input
          id="issue-title"
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
  const issues = [...journal.state.issues].sort((a, b) => b.createdAt - a.createdAt);
  if (issues.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-input px-4 py-6">
        <p className="font-medium">No issues yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">Create the first one with the form.</p>
      </div>
    );
  }
  return (
    <ul
      className="divide-y divide-border rounded-md border border-border bg-surface"
      aria-label="Issues"
    >
      {issues.map((issue) => {
        const sync = journal.issueSync(issue.id);
        return (
          <li key={issue.id}>
            <Link
              to="/w/$wsId/issues/$issueId"
              params={{ wsId: journal.workspace.wsId, issueId: issue.id }}
              className="block space-y-1.5 px-4 py-3 hover:bg-muted"
            >
              <span className="block font-medium leading-snug">{issue.title}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <IssueStatusLabel status={issue.status} />
                <span className="text-sm text-muted-foreground">
                  {issue.createdBy.name} · {issue.comments.length}{' '}
                  {issue.comments.length === 1 ? 'comment' : 'comments'}
                </span>
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
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="issues-heading" className="min-w-0 space-y-4">
        <h2 id="issues-heading" className="text-lg font-semibold">
          Issues
        </h2>
        <NewIssueForm />
        <IssueList />
      </section>
      <aside aria-label="Workspace tools" className="space-y-6">
        {journal.workspace.role === 'owner' ? <OwnerInvite /> : null}
        <ExportPanel />
      </aside>
    </div>
  );
}
