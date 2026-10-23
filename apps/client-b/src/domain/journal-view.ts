import type { Issue, JournalState, Op } from '@packout/sdk';

/** An operation with its position in the history Portaldot admitted. `blockNumber` is known only for writes made on this device. */
export type AnchoredOp = { op: Op; index: number; blockNumber: number | null };

export type IssueView = {
  issue: Issue;
  /** The operation that created the issue: its position in the anchored history. */
  created: AnchoredOp;
  /** The operation that last changed the status, if any. */
  statusOp: AnchoredOp | null;
  comments: { comment: Issue['comments'][number]; stored: AnchoredOp }[];
};

/** Pairs every reduced issue and comment with the anchored operation it came from. Newest issue first. */
export function viewJournal(state: JournalState, ops: readonly AnchoredOp[]): IssueView[] {
  const byOpId = new Map(ops.map((stored) => [stored.op.opId, stored]));
  const lastStatus = new Map<string, AnchoredOp>();
  for (const stored of ops) {
    if (stored.op.type === 'issue.setStatus') lastStatus.set(stored.op.body.issueId, stored);
  }
  const views: IssueView[] = [];
  for (const issue of state.issues) {
    const created = byOpId.get(issue.id);
    if (!created) continue;
    const comments = issue.comments.flatMap((comment) => {
      const stored = byOpId.get(comment.opId);
      return stored ? [{ comment, stored }] : [];
    });
    views.push({ issue, created, statusOp: lastStatus.get(issue.id) ?? null, comments });
  }
  return views.sort((a, b) => b.created.index - a.created.index);
}
