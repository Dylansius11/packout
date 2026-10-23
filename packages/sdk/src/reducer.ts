import type { Hex } from 'viem';
import type { IssueStatus, Op, OpAuthor } from './op.ts';

export type Issue = {
  id: Hex;
  title: string;
  description: string;
  status: IssueStatus;
  createdBy: OpAuthor;
  createdAt: number;
  comments: { opId: Hex; text: string; author: OpAuthor; ts: number }[];
};
export type JournalState = { issues: Issue[]; orphans: Op[] };

export function reduceJournal(ops: readonly Op[]): JournalState {
  const issues = new Map<Hex, Issue>();
  const orphans: Op[] = [];
  // Collect creations first: only references absent from the entire history are orphans.
  for (const op of ops) {
    if (op.type === 'issue.create' && !issues.has(op.opId)) {
      issues.set(op.opId, {
        id: op.opId,
        title: op.body.title,
        description: op.body.description,
        status: 'open',
        createdBy: { ...op.author },
        createdAt: op.ts,
        comments: [],
      });
    }
  }
  for (const op of ops) {
    if (op.type === 'issue.create') continue;
    const issue = issues.get(op.body.issueId);
    if (!issue) {
      orphans.push(op);
    } else if (op.type === 'issue.setStatus') {
      issue.status = op.body.status;
    } else {
      issue.comments.push({
        opId: op.opId,
        text: op.body.text,
        author: { ...op.author },
        ts: op.ts,
      });
    }
  }
  return { issues: [...issues.values()], orphans };
}
