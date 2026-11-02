import { Check, CircleNotch, Minus, X } from '@phosphor-icons/react';
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

const node: Record<StepRowStatus, string> = {
  pending: 'border-border-strong bg-surface',
  working: 'border-primary bg-primary-soft text-primary',
  done: 'border-primary bg-primary text-primary-foreground',
  failed: 'border-danger bg-danger text-white',
  skipped: 'border-dashed border-input bg-surface text-muted-foreground',
};

/**
 * One line of a visible step list, drawn as a stepper: a node on a rail. The status is a word for
 * assistive tech and a shape for everyone; the rail fills once a step is done.
 */
export function StepRow({
  status,
  title,
  children,
}: {
  status: StepRowStatus;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li
      className="relative flex gap-3.5 pb-5 last:pb-0 [&:not(:last-child)>[data-rail]]:block"
      data-step-status={status}
    >
      <span
        data-rail
        aria-hidden="true"
        className={cn(
          'absolute left-[11px] top-7 -bottom-0.5 hidden w-px transition-colors duration-300',
          status === 'done' ? 'bg-primary' : 'bg-border-strong',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 mt-px flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
          node[status],
        )}
      >
        {status === 'done' ? (
          <Check size={13} weight="bold" className="chip-in" />
        ) : status === 'failed' ? (
          <X size={13} weight="bold" className="chip-in" />
        ) : status === 'working' ? (
          <CircleNotch size={14} weight="bold" className="spin" />
        ) : status === 'skipped' ? (
          <Minus size={12} weight="bold" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1 break-words pt-px">
        <p className="font-medium leading-snug">
          {title}
          <span className="sr-only">: {statusWord[status]}</span>
        </p>
        {children ? (
          <div className="mt-1 space-y-1 text-sm text-muted-foreground">{children}</div>
        ) : null}
      </div>
    </li>
  );
}
