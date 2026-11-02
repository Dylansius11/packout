import { ArrowLeft } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { Avatar } from '@/components/avatar';
import { Notice } from '@/components/notice';
import { SyncBadge } from '@/components/sync-badge';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { useRestoreFocusWhenIdle } from '../../lib/focus';
import { formatTime } from '../../lib/format';
import { parseHex16 } from '../../lib/ids';
import { stagger } from '../../lib/utils';
import { IssueStatusLabel, STATUS_LABEL } from './issue-status';
import { DataLocationNote } from './issues-page';
import { useJournalContext } from './journal-context';

const STATUSES = ['open', 'in_progress', 'done'] as const;

function CommentForm({ issueId }: { issueId: Hex }) {
  const journal = useJournalContext();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useRestoreFocusWhenIdle(busy, textRef);

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
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-raised"
      aria-label="Add a comment"
    >
      <div>
        <Label htmlFor="comment-text">Comment</Label>
        <Textarea
          id="comment-text"
          ref={textRef}
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
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-0"
    >
      <ArrowLeft size={14} aria-hidden />
      All issues
    </Link>
  );

  if (!issue || !issueId) {
    return (
      <div className="max-w-2xl space-y-4">
        {back}
        <Notice tone="warning" title="This issue is not on this device">
          It may still be on its way from Vendor A. This page updates when it arrives.
        </Notice>
      </div>
    );
  }
  const sync = journal.issueSync(issue.id);

  return (
    <article className="max-w-3xl space-y-10">
      <div className="space-y-5">
        {back}
        <header className="space-y-5">
          <h2 className="display break-words text-3xl md:text-4xl">{issue.title}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <IssueStatusLabel status={issue.status} />
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar name={issue.createdBy.name} size="sm" />
              <span>
                Opened by{' '}
                <strong className="font-medium text-foreground">{issue.createdBy.name}</strong> ·{' '}
                {formatTime(issue.createdAt)}
              </span>
            </span>
            {sync ? <SyncBadge state={sync} showBlock /> : null}
          </div>
          {issue.description ? (
            <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed">
              {issue.description}
            </p>
          ) : null}
          <div className="max-w-xs rounded-lg border border-border bg-surface p-4 shadow-card">
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
            <p className="mt-1.5 text-xs text-muted-foreground">
              Changing it is a new encrypted operation, like a comment.
            </p>
          </div>
        </header>
      </div>

      <section aria-labelledby="comments-heading" className="space-y-5 border-t border-border pt-8">
        <h3 id="comments-heading" className="display text-2xl">
          Comments ({issue.comments.length})
        </h3>
        {issue.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-5" aria-label="Comments">
            {issue.comments.map((comment, index) => {
              const commentSync = journal.syncOf(comment.opId);
              return (
                <li
                  key={comment.opId}
                  className="row-in grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3.5"
                  style={stagger(index)}
                >
                  <Avatar name={comment.author.name} className="mt-0.5" />
                  <div className="min-w-0 space-y-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
                    <p className="text-sm text-muted-foreground">
                      <strong className="font-medium text-foreground">{comment.author.name}</strong>{' '}
                      · {formatTime(comment.ts)}
                    </p>
                    <p className="max-w-[65ch] whitespace-pre-wrap">{comment.text}</p>
                    {commentSync ? <SyncBadge state={commentSync} showBlock /> : null}
                  </div>
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
