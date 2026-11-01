import { waitForFinalized } from '@packout/sdk';
import { useCallback, useState } from 'react';
import type { Hex } from 'viem';
import { describeFailure } from '../lib/errors.ts';

export type TxState =
  | { phase: 'idle' }
  | { phase: 'preparing'; startedAt: number }
  | { phase: 'wallet'; startedAt: number }
  | { phase: 'submitted'; startedAt: number; hash: Hex }
  | { phase: 'included'; startedAt: number; hash: Hex; blockNumber: number }
  | { phase: 'finalized'; hash: Hex; blockNumber: number }
  | { phase: 'unfinalized'; hash: Hex; blockNumber: number; message: string }
  | { phase: 'failed'; message: string };

export type TxProgress = {
  preparing(): void;
  wallet(): void;
  submitted(hash: Hex): void;
};

export const txPending = (state: TxState) =>
  state.phase === 'preparing' ||
  state.phase === 'wallet' ||
  state.phase === 'submitted' ||
  state.phase === 'included';

type FinalityClient = Parameters<typeof waitForFinalized>[0];
type IncludedTx = { hash: Hex; blockNumber: number };

/** A successful receipt is returned even if finality is unknown: never invite a duplicate send. */
export async function runTransaction<T extends IncludedTx>(
  client: FinalityClient,
  work: (progress: TxProgress) => Promise<T>,
  setState: (state: TxState) => void,
): Promise<T | null> {
  const startedAt = Date.now();
  setState({ phase: 'preparing', startedAt });
  let result: T;
  try {
    result = await work({
      preparing: () => setState({ phase: 'preparing', startedAt }),
      wallet: () => setState({ phase: 'wallet', startedAt }),
      submitted: (hash) => setState({ phase: 'submitted', startedAt, hash }),
    });
  } catch (error) {
    setState({ phase: 'failed', message: describeFailure(error) });
    return null;
  }

  const included = { hash: result.hash, blockNumber: result.blockNumber };
  setState({ phase: 'included', startedAt: Date.now(), ...included });
  try {
    await waitForFinalized(client, BigInt(result.blockNumber));
    setState({ phase: 'finalized', ...included });
  } catch (error) {
    setState({ phase: 'unfinalized', ...included, message: describeFailure(error) });
  }
  return result;
}

/** Tracks one chain action through inclusion to the RPC's finalized block. */
export function useTx(client: FinalityClient) {
  const [state, setState] = useState<TxState>({ phase: 'idle' });
  const run = useCallback(
    <T extends IncludedTx>(work: (progress: TxProgress) => Promise<T>) =>
      runTransaction(client, work, setState),
    [client],
  );
  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  return { state, run, reset };
}
