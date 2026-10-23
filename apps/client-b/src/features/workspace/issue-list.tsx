import type { IssueStatus } from '@packout/sdk';
import type { ReactNode } from 'react';
import { AnchorBadge } from '@/components/anchor-badge';
import { cn } from '@/lib/utils';
import type { IssueView } from '../../domain/journal-view';
import { formatTime } from '../../lib/format';

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
};

const statusTone: Record<IssueStatus, string> = {
  open: 'border-input text-foreground',
  in_progress: 'border-warning-line bg-warning-soft text-warning',
  done: 'border-success-line bg-success-soft text-success',
};

/** The restored journal. Every issue and comment carries the position Portaldot gave it. */
export function IssueList({
  views,
  renderActions,
}: {
  views: IssueView[];
  renderActions?: (view: IssueView) => ReactNode;
}) {
  if (views.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        This workspace has no issues yet.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {views.map((view) => (
        <li key={view.issue.id}>
          <article
            aria-labelledby={`issue-${view.issue.id}`}
            className="space-y-3 rounded-md border border-border bg-surface p-4"
          >
            <header className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <h3 id={`issue-${view.issue.id}`} className="text-base font-semibold break-words">
                  {view.issue.title}
                </h3>
                <span
                  className={cn(
                    'shrink-0 rounded-sm border px-2 py-0.5 text-xs font-medium',
                    statusTone[view.issue.status],
                  )}
                >
                  {STATUS_LABEL[view.issue.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {view.issue.createdBy.name} · {formatTime(view.issue.createdAt)}
              </p>
            </header>
            {view.issue.description ? (
              <p className="whitespace-pre-wrap break-words text-sm">{view.issue.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <AnchorBadge stored={view.created} />
              {view.statusOp ? (
                <span className="inline-flex gap-1.5 text-xs text-muted-foreground">
                  Status changed · <AnchorBadge stored={view.statusOp} />
                </span>
              ) : null}
            </div>
            {view.comments.length > 0 ? (
              <ul className="divide-y divide-border border-t border-border">
                {view.comments.map(({ comment, stored }) => (
                  <li key={comment.opId} className="space-y-1 py-2.5 text-sm">
                    <p className="whitespace-pre-wrap break-words">{comment.text}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>
                        {comment.author.name} · {formatTime(comment.ts)}
                      </span>
                      <AnchorBadge stored={stored} />
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {renderActions?.(view)}
          </article>
        </li>
      ))}
    </ul>
  );
}
