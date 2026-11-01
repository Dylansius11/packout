import type { Hex } from 'viem';
import { afterEach, expect, test, vi } from 'vitest';
import { runTransaction, type TxState, txPending } from '../src/hooks/use-tx.ts';

const hash: Hex = `0x${'ab'.repeat(32)}`;
const receipt = { hash, blockNumber: 10 };

afterEach(() => vi.useRealTimers());

test('keeps an included transaction pending until finalized height covers its receipt block', async () => {
  vi.useFakeTimers();
  let height: bigint | null = null;
  const states: TxState[] = [];
  const run = runTransaction(
    {
      async getBlock({ blockTag }) {
        expect(blockTag).toBe('finalized');
        return { number: height };
      },
    },
    async (progress) => {
      progress.wallet();
      progress.submitted(hash);
      return receipt;
    },
    (state) => states.push(state),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(states.at(-1)).toMatchObject({ phase: 'included', ...receipt });
  expect(txPending(states.at(-1) as TxState)).toBe(true);

  height = 9n;
  await vi.advanceTimersByTimeAsync(1000);
  expect(states.at(-1)?.phase).toBe('included');

  height = 10n;
  await vi.advanceTimersByTimeAsync(1000);
  expect(await run).toEqual(receipt);
  expect(states.at(-1)).toEqual({ phase: 'finalized', ...receipt });
  expect(txPending(states.at(-1) as TxState)).toBe(false);
});

test('retains inclusion and the transaction reference when finality times out', async () => {
  vi.useFakeTimers();
  const states: TxState[] = [];
  const run = runTransaction(
    { getBlock: async () => ({ number: 9n }) },
    async () => receipt,
    (state) => states.push(state),
  );
  await vi.advanceTimersByTimeAsync(120_000);
  expect(await run).toEqual(receipt);
  expect(states.at(-1)).toMatchObject({
    phase: 'unfinalized',
    ...receipt,
    message: expect.stringMatching(/not.*finalized.*timeout.*120 seconds/i),
  });
  expect(states.some((state) => state.phase === 'finalized')).toBe(false);
});

test('preserves a reverted transaction reason without starting a finality wait', async () => {
  const states: TxState[] = [];
  const result = await runTransaction(
    {
      getBlock: async () => {
        throw new Error('Finality must not be queried for a revert.');
      },
    },
    async () => {
      throw new Error('Registry transaction reverted: NotWriter');
    },
    (state) => states.push(state),
  );
  expect(result).toBeNull();
  expect(states.at(-1)).toEqual({
    phase: 'failed',
    message: 'Registry transaction reverted: NotWriter',
  });
  expect(states.some((state) => state.phase === 'included' || state.phase === 'finalized')).toBe(
    false,
  );
});

test('does not label an included transaction failed when the finality RPC is unavailable', async () => {
  const states: TxState[] = [];
  const result = await runTransaction(
    {
      getBlock: async () => {
        throw new Error('RPC is unavailable.');
      },
    },
    async () => receipt,
    (state) => states.push(state),
  );
  expect(result).toEqual(receipt);
  expect(states.at(-1)).toMatchObject({
    phase: 'unfinalized',
    ...receipt,
    message: 'RPC is unavailable.',
  });
});
