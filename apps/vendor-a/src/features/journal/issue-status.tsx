import type { IssueStatus } from '@packout/sdk';
import { CheckCircle, Circle, CircleHalf } from '@phosphor-icons/react';

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
};

const STATUS_ICON = { open: Circle, in_progress: CircleHalf, done: CheckCircle } as const;

export function IssueStatusLabel({ status }: { status: IssueStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon size={16} weight={status === 'done' ? 'fill' : 'bold'} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
