import type * as React from 'react';
import { cn } from '@/lib/utils';

const field =
  'w-full rounded-md border border-input bg-surface px-3 text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-foreground/50 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(field, 'h-11 text-base md:h-10 md:text-sm', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(field, 'min-h-24 py-2.5 text-base md:text-sm', className)} {...props} />
  );
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(field, 'select-caret h-11 text-base md:h-10 md:text-sm', className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor or wrap the control
  return <label className={cn('mb-1.5 block text-[13px] font-medium', className)} {...props} />;
}
