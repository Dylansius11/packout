import { CheckCircle, CircleNotch, MinusCircle, XCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type StepRowStatus = 'working' | 'pass' | 'fail' | 'skipped';

const statusWord: Record<StepRowStatus, string> = {
  working: 'Checking',
  pass: 'Passed',
  fail: 'Failed',
  skipped: 'Not checked',
};

/** One line of a visible check list. The status is a word for assistive tech and an icon for everyone. */
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
    status === 'pass' && 'text-success',
    status === 'fail' && 'text-danger',
    status === 'working' && 'text-primary',
    status === 'skipped' && 'text-muted-foreground',
  );
  return (
    <li className="flex gap-3 py-3" data-step-status={status}>
      {status === 'pass' ? (
        <CheckCircle size={20} weight="fill" className={iconClass} aria-hidden />
      ) : status === 'fail' ? (
        <XCircle size={20} weight="fill" className={iconClass} aria-hidden />
      ) : status === 'working' ? (
        <CircleNotch size={20} weight="bold" className={cn(iconClass, 'spin')} aria-hidden />
      ) : (
        <MinusCircle size={20} className={iconClass} aria-hidden />
      )}
      <div className="min-w-0 flex-1 break-words">
        <p className="font-medium leading-snug">
          {title}
          <span className="sr-only">: {statusWord[status]}</span>
        </p>
        {children ? (
          <div
            className={cn(
              'mt-0.5 space-y-1 text-sm',
              status === 'fail' ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}
