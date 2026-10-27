import { z } from 'zod';

export const PIN = {
  specName: 'portaldot-v3',
  specVersion: 3002,
  transactionVersion: 2,
  metadataHash: '0x8e34715899853d7ff6a2ca16c62c490a3474bc4ac2f319025672c8d092567ec2',
};
export const UNIT = 100_000_000_000_000n;
export function fundingPlan(reuseBalances?: bigint[]) {
  const target = { N: (UNIT * 4n) / 10n, B1: UNIT / 5n, B2: UNIT / 5n, B3: UNIT / 5n };
  const forward = { ...target };
  if (reuseBalances) {
    if (reuseBalances.length !== 4)
      throw new Error('Reuse funding requires N and all three backup balances.');
    for (const [index, role] of (['N', 'B1', 'B2', 'B3'] as const).entries()) {
      const shortfall = target[role] - reuseBalances[index];
      forward[role] = shortfall > 0n ? shortfall : 0n;
    }
  }
  const forwarded = Object.values(forward).reduce((sum, value) => sum + value, 0n);
  const requiredW = reuseBalances ? (UNIT * 45n) / 10n + forwarded : (UNIT * 185n) / 10n;
  return { target, forward, forwarded, requiredW, retainedW: requiredW - forwarded };
}
export interface Check {
  pass: boolean;
  message: string;
}
export function preflightReady(checks: Pick<Check, 'pass'>[]): boolean {
  return checks.length > 0 && checks.every((check) => check.pass);
}
export function requireInnerSuccess(value: unknown): void {
  const result = z.object({ ok: z.null() }).safeParse(value);
  if (!result.success) {
    if (value === undefined)
      throw new Error('RecoveredAccountControlled event missing; outer success is not proof.');
    throw new Error(`Recovery inner dispatch failed: ${JSON.stringify(value)}`);
  }
}
// The spike's negative steps (one-approval finish, approve, early finish) each wait for finality,
// about 3 blocks apiece on testnet (2-block finality lag), so they need a longer window than the demo.
export const SPIKE_DELAY_BLOCKS = 24;
export const DEMO_DELAY_BLOCKS = 10;
export function parseOptions(args: string[]): { spike: boolean; delayBlocks: number } {
  let spike = false;
  let delayBlocks: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spike') spike = true;
    else if (args[i] === '--delay-blocks') {
      const parsed = z.coerce.number().int().min(1).max(0xffffffff).safeParse(args[++i]);
      if (!parsed.success)
        throw new Error('--delay-blocks must be an integer from 1 to 4294967295.');
      delayBlocks = parsed.data;
    } else
      throw new Error(
        'Testnet only: use --delay-blocks N; native pallets cannot be rehearsed on Hardhat.',
      );
  }
  return { spike, delayBlocks: delayBlocks ?? (spike ? SPIKE_DELAY_BLOCKS : DEMO_DELAY_BLOCKS) };
}
export const json = (value: unknown): string =>
  JSON.stringify(
    value,
    (_, item: unknown) => (typeof item === 'bigint' ? item.toString() : item),
    2,
  );
