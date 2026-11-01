import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/**
 * Every tone carries a word, never colour alone. Info and caution step back (ash text, smoke label),
 * success comes forward (ivory), and failure is the reversed cell.
 */
const tone = {
  info: { label: 'Note', labelClass: 'text-smoke', body: 'text-ash', title: 'text-ivory' },
  warning: { label: 'Heads up', labelClass: 'text-ash', body: 'text-ash', title: 'text-ivory' },
  danger: { label: 'Blocked', labelClass: 'reversed', body: 'text-ivory', title: 'text-ivory' },
  success: { label: 'Done', labelClass: 'text-ivory', body: 'text-ash', title: 'text-ivory' },
} as const;

/** A persistent message about state the user must know. Danger announces itself; the rest wait politely. */
export function Notice({
  tone: kind = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tone;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = tone[kind];
  return (
    <div role={kind === 'danger' ? 'alert' : 'status'} className={cn('state-in py-1', className)}>
      <p className={cn('baseline inline-block text-[11px] tracking-[0.12em]', style.labelClass)}>
        {style.label}
      </p>
      <p className={cn('mt-2 text-[17px] font-medium leading-snug', style.title)}>{title}</p>
      {children ? (
        <div className={cn('mt-2 max-w-[62ch] space-y-1 text-[16px] leading-relaxed', style.body)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
