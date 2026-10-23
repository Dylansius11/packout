import { useCallback, useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { describeFailure } from '../../lib/errors';
import { loadProof, type ProofData, type ProofSource } from './load-proof';

export type ProofState =
  | { phase: 'loading'; startedAt: number }
  | { phase: 'ready'; data: ProofData }
  | { phase: 'unknown' }
  | { phase: 'error'; message: string };

/** Reads one workspace's public record. `reload` starts over; a read that was superseded is dropped. */
export function useProof(
  source: ProofSource,
  wsId: Hex,
): { state: ProofState; reload: () => void } {
  const [state, setState] = useState<ProofState>({ phase: 'loading', startedAt: Date.now() });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger
  useEffect(() => {
    let current = true;
    setState({ phase: 'loading', startedAt: Date.now() });
    loadProof(source, wsId).then(
      (data) => {
        if (current) setState(data ? { phase: 'ready', data } : { phase: 'unknown' });
      },
      (error: unknown) => {
        if (current) setState({ phase: 'error', message: describeFailure(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [source, wsId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
