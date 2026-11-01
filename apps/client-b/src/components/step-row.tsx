import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/utils';

export type StepRowStatus = 'working' | 'pass' | 'fail' | 'skipped';

/** What assistive tech hears after the title. */
const statusWord: Record<StepRowStatus, string> = {
  working: 'Checking',
  pass: 'Passed',
  fail: 'Failed',
  skipped: 'Not checked',
};

/** What everyone sees in the status column: always a word, never colour alone. */
const visibleWord: Record<StepRowStatus, string> = {
  working: 'Checking',
  pass: 'Pass',
  fail: 'Failed',
  skipped: 'Not checked',
};

/**
 * One line of a visible check list, a baseline in the front plane. A pass reads in ivory, a check that
 * was never reached falls back to smoke, a failure is the reversed cell with its message beneath.
 * `order` is the line's place in the sequence the checks ran in; the lines surface in that order.
 */
export function StepRow({
  status,
  title,
  order = 0,
  children,
}: {
  status: StepRowStatus;
  title: string;
  order?: number;
  children?: ReactNode;
}) {
  const back = status === 'skipped';
  return (
    <li
      className="surface grid gap-x-6 gap-y-2 sm:grid-cols-[8.5rem_1fr]"
      data-step-status={status}
      style={{ '--order': order } as CSSProperties}
    >
      <span
        aria-hidden
        className={cn(
          'baseline h-fit w-fit text-[13px] sm:pt-[0.15em]',
          status === 'fail' ? 'reversed' : back ? 'depth-2' : 'depth-0',
        )}
      >
        {visibleWord[status]}
        {status === 'working' ? <span className="caret" /> : null}
      </span>
      <div className="min-w-0 break-words">
        <p
          className={cn(
            'baseline text-[14px] tracking-[0.12em] md:text-[15px]',
            back ? 'text-smoke' : 'text-ivory',
          )}
        >
          {title}
          <span className="sr-only">: {statusWord[status]}</span>
        </p>
        {children ? (
          <div
            className={cn(
              'mt-2 max-w-[62ch] space-y-1 text-[16px] leading-relaxed',
              status === 'fail' ? 'text-ivory' : back ? 'text-smoke' : 'text-ash',
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}
