import { cn } from '../lib/utils';

const TINTS = [
  'bg-primary-soft text-primary',
  'bg-transit-soft text-transit',
  'bg-warning-soft text-warning',
  'bg-success-soft text-success',
  'bg-muted text-foreground',
] as const;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '?';
  const last = words.length > 1 ? (words[words.length - 1] ?? first) : null;
  return [first, last]
    .flatMap((word) => (word === null ? [] : [Array.from(word)[0] ?? '?']))
    .join('')
    .toUpperCase();
}

function tintOf(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return TINTS[hash % TINTS.length] ?? TINTS[0];
}

/** Initials on a warm tint. The name is always printed next to it, so the avatar is decoration. */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium ring-1 ring-inset ring-black/5',
        size === 'sm' ? 'size-5 text-[10px]' : 'size-8 text-xs',
        tintOf(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
