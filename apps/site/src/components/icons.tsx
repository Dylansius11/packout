import type { ReactNode } from 'react';

/** One drawn icon set: 16px grid, 1.5px stroke, round caps. Decorative; the control carries the name. */
function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function CopyIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.75" />
      <path d="M10.75 5.25V4A1.75 1.75 0 0 0 9 2.25H4A1.75 1.75 0 0 0 2.25 4v5A1.75 1.75 0 0 0 4 10.75h1.25" />
    </Icon>
  );
}

export function CheckIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m3.25 8.5 3 3 6.5-7" />
    </Icon>
  );
}

export function ArrowIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
    </Icon>
  );
}

export function SearchIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </Icon>
  );
}

export function ChevronIcon({
  direction,
  className = 'size-4',
}: {
  direction: 'left' | 'right';
  className?: string;
}) {
  return (
    <Icon className={className}>
      <path d={direction === 'left' ? 'm9.75 3.5-4.5 4.5 4.5 4.5' : 'm6.25 3.5 4.5 4.5-4.5 4.5'} />
    </Icon>
  );
}
