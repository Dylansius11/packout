import type { Hex } from 'viem';

/** A 32-byte lowercase hex id (workspace id, salt, issue id when 16 bytes uses `parseHex16`). Null for anything else. */
export function parseHex32(value: string): Hex | null {
  return /^0x[0-9a-f]{64}$/.test(value) ? (value as Hex) : null;
}

export function parseHex16(value: string): Hex | null {
  return /^0x[0-9a-f]{32}$/.test(value) ? (value as Hex) : null;
}
