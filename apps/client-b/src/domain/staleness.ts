import type { Hex } from 'viem';

/** Portaldot's history is not the history this device holds. Nothing was written. */
export class StaleHistoryError extends Error {
  override readonly name = 'StaleHistoryError';
}

/** Null when the device's history is exactly the chain's; otherwise a plain sentence saying how they differ. */
export function staleness(
  local: { count: number; head: Hex },
  chain: { count: bigint; head: Hex },
): string | null {
  const localCount = BigInt(local.count);
  if (chain.count > localCount) {
    return `Portaldot has ${operations(chain.count - localCount)} newer than this device (${chain.count} against ${localCount}). Someone else wrote to this workspace. Nothing was written. Get a newer export and import it, then try again.`;
  }
  if (chain.count < localCount) {
    return `This device holds ${operations(localCount - chain.count)} that Portaldot never admitted. Nothing was written.`;
  }
  if (chain.head !== local.head) {
    return 'Portaldot has a different history head than this device at the same length. Nothing was written. Import a fresh export.';
  }
  return null;
}

function operations(n: bigint): string {
  return n === 1n ? '1 operation' : `${n} operations`;
}
