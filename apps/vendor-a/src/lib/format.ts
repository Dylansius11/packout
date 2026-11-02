import type { Hex } from 'viem';

/** `0x1234abcd…ef0123`: enough to recognise a hash without filling a row. */
export function shortHex(value: Hex): string {
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    timestamp,
  );
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

/** "just now", "3 min. ago", "2 hr. ago", "yesterday". Past a week it falls back to the date. */
export function formatRelative(timestamp: number, now: number): string {
  const seconds = Math.round((timestamp - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(timestamp);
}
