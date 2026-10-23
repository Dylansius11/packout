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
