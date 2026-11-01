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

/** Rank by brightness: work that is finished or moving comes forward, open work waits in ash. */
const statusTone: Record<IssueStatus, string> = {
  open: 'text-ash',
  in_progress: 'text-ivory',
  done: 'text-ivory',
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
    return <p className="prose-ash">This workspace has no issues yet.</p>;
  }
  return (
    <ul className="space-y-14">
      {views.map((view) => (
        <li key={view.issue.id}>
          <article
            aria-labelledby={`issue-${view.issue.id}`}
            className="space-y-5 border-t border-dust pt-6"
          >
            <header className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <h3
                  id={`issue-${view.issue.id}`}
                  className="display min-w-0 text-[clamp(1.25rem,2.2vw,1.75rem)] text-ivory"
                >
                  {view.issue.title}
                </h3>
                <span
                  className={cn(
                    'baseline shrink-0 pt-[0.35em] text-[12px]',
                    statusTone[view.issue.status],
                  )}
                >
                  {STATUS_LABEL[view.issue.status]}
                </span>
              </div>
              <p className="text-[14px] text-smoke">
                {view.issue.createdBy.name} · {formatTime(view.issue.createdAt)}
              </p>
            </header>
            {view.issue.description ? (
              <p className="max-w-[62ch] whitespace-pre-wrap break-words text-[17px] leading-relaxed text-ash">
                {view.issue.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <AnchorBadge stored={view.created} />
              {view.statusOp ? (
                <span className="baseline depth-2 text-[11px]">
                  Status changed · <AnchorBadge stored={view.statusOp} />
                </span>
              ) : null}
            </div>
            {view.comments.length > 0 ? (
              <ul className="space-y-5 pt-2">
                {view.comments.map(({ comment, stored }) => (
                  <li key={comment.opId} className="space-y-1.5">
                    <p className="max-w-[62ch] whitespace-pre-wrap break-words text-[16px] leading-relaxed text-ivory">
                      {comment.text}
                    </p>
                    <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                      <span className="text-[14px] text-smoke">
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
