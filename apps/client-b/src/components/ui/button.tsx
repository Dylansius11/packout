import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * default: the one amber action of a view. outline: a bracketed command. ghost: an underlined
 * pixel link. danger: reversed when reached for, because what it does cannot be undone here.
 */
export const buttonVariants = cva(
  'select-none text-left whitespace-normal sm:whitespace-nowrap disabled:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'signal',
        outline: 'command',
        ghost: 'ghost-link px-1 py-2 text-[12px] disabled:no-underline',
        danger: 'forget',
      },
      size: {
        default: '',
        sm: 'text-[11px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  type = 'button',
  children,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  const bracketed = variant === 'outline';
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {bracketed ? (
        <>
          <span aria-hidden className="bracket">
            [
          </span>
          <span className="label">{children}</span>
          <span aria-hidden className="bracket">
            ]
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
