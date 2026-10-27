import { z } from 'zod';

const amount = z.union([z.string(), z.number()]).transform(BigInt);
const weight = z.object({ refTime: amount, proofSize: amount });
const deposit = z.union([z.object({ charge: amount }), z.object({ refund: amount })]);
const resultSchema = z.object({
  weightRequired: weight,
  storageDeposit: deposit,
  maxStorageDeposit: deposit,
  result: z.union([
    z.object({ ok: z.object({ flags: z.object({ bits: z.number() }), data: z.string() }) }),
    z.object({ err: z.unknown() }),
  ]),
});
export function executionBounds(value: unknown) {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      'Native Revive dry-run returned an unsupported result shape; no transaction sent.',
    );
  const data = parsed.data;
  if ('err' in data.result)
    throw new Error(`Native Revive dry-run dispatch failed: ${JSON.stringify(data.result.err)}`);
  if ((data.result.ok.flags.bits & 1) !== 0)
    throw new Error(`Native Revive dry-run EVM reverted: ${data.result.ok.data}`);
  return {
    weight: data.weightRequired,
    storage: 'charge' in data.maxStorageDeposit ? data.maxStorageDeposit.charge : 0n,
    deposit: data.storageDeposit,
  };
}
