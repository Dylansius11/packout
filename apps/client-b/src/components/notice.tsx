import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

const tone = {
  info: 'border-border bg-surface',
  warning: 'border-warning-line bg-warning-soft text-warning',
  danger: 'border-danger-line bg-danger-soft text-danger',
  success: 'border-success-line bg-success-soft text-success',
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
  return (
    <div
      role={kind === 'danger' ? 'alert' : 'status'}
      className={cn('state-in rounded-md border px-4 py-3 text-sm', tone[kind], className)}
    >
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 leading-relaxed">{children}</div> : null}
    </div>
  );
}
