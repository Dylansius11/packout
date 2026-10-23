import { ArrowLeft } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import type { Hex } from 'viem';
import { Notice } from '@/components/notice';
import { SyncBadge } from '@/components/sync-badge';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { formatTime } from '../../lib/format';
import { parseHex16 } from '../../lib/ids';
import { IssueStatusLabel, STATUS_LABEL } from './issue-status';
import { DataLocationNote } from './issues-page';
import { useJournalContext } from './journal-context';

const STATUSES = ['open', 'in_progress', 'done'] as const;

function CommentForm({ issueId }: { issueId: Hex }) {
  const journal = useJournalContext();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await journal.addComment(issueId, text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Add a comment">
      <div>
        <Label htmlFor="comment-text">Comment</Label>
        <Textarea
          id="comment-text"
          required
          maxLength={5000}
          value={text}
          disabled={!journal.canWrite}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy || !journal.canWrite || text.trim() === ''}>
        Add comment
      </Button>
      <DataLocationNote />
    </form>
  );
}

export function IssuePage({ issueId: param }: { issueId: string }) {
  const journal = useJournalContext();
  const issueId = parseHex16(param);
  const issue = journal.state.issues.find((candidate) => candidate.id === issueId);
  const back = (
    <Link
      to="/w/$wsId"
      params={{ wsId: journal.workspace.wsId }}
      className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
    >
      <ArrowLeft size={14} aria-hidden />
      All issues
    </Link>
  );

  if (!issue || !issueId) {
    return (
      <div className="space-y-4">
        {back}
        <Notice tone="warning" title="This issue is not on this device">
          It may still be on its way from Vendor A. This page updates when it arrives.
        </Notice>
      </div>
    );
  }
  const sync = journal.issueSync(issue.id);

  return (
    <article className="space-y-8">
      {back}
      <header className="space-y-3">
        <h2 className="text-xl font-semibold leading-snug">{issue.title}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <IssueStatusLabel status={issue.status} />
          <span className="text-sm text-muted-foreground">
            Opened by {issue.createdBy.name} · {formatTime(issue.createdAt)}
          </span>
          {sync ? <SyncBadge state={sync} showBlock /> : null}
        </div>
        {issue.description ? (
          <p className="max-w-[65ch] whitespace-pre-wrap">{issue.description}</p>
        ) : null}
        <div className="max-w-xs">
          <Label htmlFor="issue-status">Status</Label>
          <Select
            id="issue-status"
            value={issue.status}
            disabled={!journal.canWrite}
            onChange={(event) => {
              const next = STATUSES.find((status) => status === event.target.value);
              if (next) void journal.setStatus(issue.id, next);
            }}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Changing it is a new encrypted operation, like a comment.
          </p>
        </div>
      </header>

      <section aria-labelledby="comments-heading" className="space-y-4">
        <h3 id="comments-heading" className="text-base font-semibold">
          Comments ({issue.comments.length})
        </h3>
        {issue.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul
            className="divide-y divide-border rounded-md border border-border bg-surface"
            aria-label="Comments"
          >
            {issue.comments.map((comment) => {
              const commentSync = journal.syncOf(comment.opId);
              return (
                <li key={comment.opId} className="space-y-1.5 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    <strong className="font-medium text-foreground">{comment.author.name}</strong> ·{' '}
                    {formatTime(comment.ts)}
                  </p>
                  <p className="max-w-[65ch] whitespace-pre-wrap">{comment.text}</p>
                  {commentSync ? <SyncBadge state={commentSync} showBlock /> : null}
                </li>
              );
            })}
          </ul>
        )}
        <CommentForm issueId={issue.id} />
      </section>
    </article>
  );
}
