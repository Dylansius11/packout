import { useCallback, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { describeFailure } from '../lib/errors.ts';

export type TxState =
  | { phase: 'idle' }
  | { phase: 'preparing'; startedAt: number }
  | { phase: 'wallet'; startedAt: number }
  | { phase: 'submitted'; startedAt: number; hash: Hex }
  | { phase: 'confirmed'; hash: Hex; blockNumber: number }
  | { phase: 'failed'; message: string };

export type TxProgress = {
  preparing(): void;
  wallet(): void;
  submitted(hash: Hex): void;
};

export const txPending = (state: TxState) =>
  state.phase === 'preparing' || state.phase === 'wallet' || state.phase === 'submitted';

/** Tracks one chain action from preparation to inclusion, so the screen always says what is really happening. */
export function useTx() {
  const [state, setState] = useState<TxState>({ phase: 'idle' });
  const startedAt = useRef(0);

  const run = useCallback(
    async <T extends { hash: Hex; blockNumber: number }>(
      work: (progress: TxProgress) => Promise<T>,
    ): Promise<T | null> => {
      startedAt.current = Date.now();
      const at = () => startedAt.current;
      setState({ phase: 'preparing', startedAt: at() });
      try {
        const result = await work({
          preparing: () => setState({ phase: 'preparing', startedAt: at() }),
          wallet: () => setState({ phase: 'wallet', startedAt: at() }),
          submitted: (hash) => setState({ phase: 'submitted', startedAt: at(), hash }),
        });
        setState({ phase: 'confirmed', hash: result.hash, blockNumber: result.blockNumber });
        return result;
      } catch (error) {
        setState({ phase: 'failed', message: describeFailure(error) });
        return null;
      }
    },
    [],
  );
  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  return { state, run, reset };
}
