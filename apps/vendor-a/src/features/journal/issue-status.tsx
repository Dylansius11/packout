import type { IssueStatus } from '@packout/sdk';
import { cn } from '@/lib/utils';

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
};

const CHIP: Record<IssueStatus, { chip: string; dot: string }> = {
  open: {
    chip: 'border-border-strong bg-surface text-foreground',
    dot: 'border-[1.5px] border-foreground',
  },
  in_progress: {
    chip: 'border-transit-line bg-transit-soft text-transit',
    dot: 'bg-transit',
  },
  done: {
    chip: 'border-primary-line bg-primary-soft text-primary',
    dot: 'bg-primary',
  },
};

/** A status as a chip with a dot. Keyed by status, so a change plays one short entrance. */
export function IssueStatusLabel({ status }: { status: IssueStatus }) {
  const { chip, dot } = CHIP[status];
  return (
    <span
      key={status}
      className={cn(
        'chip-in inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
        chip,
      )}
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}
