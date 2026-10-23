import {
  CheckCircle,
  CircleDashed,
  CircleNotch,
  MinusCircle,
  XCircle,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type StepRowStatus = 'pending' | 'working' | 'done' | 'failed' | 'skipped';

const statusWord: Record<StepRowStatus, string> = {
  pending: 'Not started',
  working: 'In progress',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Not checked',
};

/** One line of a visible step list. The status is a word for assistive tech and an icon for everyone. */
export function StepRow({
  status,
  title,
  children,
}: {
  status: StepRowStatus;
  title: string;
  children?: ReactNode;
}) {
  const iconClass = cn(
    'mt-0.5 shrink-0',
    status === 'done' && 'text-success',
    status === 'failed' && 'text-danger',
    status === 'working' && 'text-primary',
    (status === 'pending' || status === 'skipped') && 'text-muted-foreground',
  );
  return (
    <li className="flex gap-3 py-3" data-step-status={status}>
      {status === 'done' ? (
        <CheckCircle size={20} weight="fill" className={iconClass} aria-hidden />
      ) : status === 'failed' ? (
        <XCircle size={20} weight="fill" className={iconClass} aria-hidden />
      ) : status === 'working' ? (
        <CircleNotch size={20} weight="bold" className={cn(iconClass, 'spin')} aria-hidden />
      ) : status === 'skipped' ? (
        <MinusCircle size={20} className={iconClass} aria-hidden />
      ) : (
        <CircleDashed size={20} className={iconClass} aria-hidden />
      )}
      <div className="min-w-0 flex-1 break-words">
        <p className="font-medium leading-snug">
          {title}
          <span className="sr-only">: {statusWord[status]}</span>
        </p>
        {children ? (
          <div className="mt-0.5 space-y-1 text-sm text-muted-foreground">{children}</div>
        ) : null}
      </div>
    </li>
  );
}
