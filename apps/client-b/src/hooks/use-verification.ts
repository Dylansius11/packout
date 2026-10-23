import { type VerificationReport, verifyBundle } from '@packout/sdk';
import { useCallback, useRef, useState } from 'react';
import { registryReader } from '../chain/clients.ts';
import { describeFailure } from '../lib/errors.ts';

export type VerificationSource = 'file' | 'device';

export type VerificationState =
  | { phase: 'idle' }
  | { phase: 'running'; source: VerificationSource; startedAt: number }
  | { phase: 'done'; source: VerificationSource; report: VerificationReport }
  /** Portaldot could not be asked. This says nothing about the bundle itself. */
  | { phase: 'unreachable'; source: VerificationSource; message: string };

/** Runs the SDK verifier against Portaldot. A newer run supersedes an older one that is still in flight. */
export function useVerification() {
  const [state, setState] = useState<VerificationState>({ phase: 'idle' });
  /** The newest finished report, kept while a re-check runs so screens do not blink empty. */
  const [latestReport, setLatestReport] = useState<VerificationReport | null>(null);
  const latest = useRef(0);

  const verify = useCallback(
    async (
      input: { bundle: unknown; key: Uint8Array },
      source: VerificationSource,
    ): Promise<VerificationReport | null> => {
      const run = ++latest.current;
      if (!registryReader) {
        setState({
          phase: 'unreachable',
          source,
          message: 'This build has no registry address, so nothing can be checked.',
        });
        return null;
      }
      setState({ phase: 'running', source, startedAt: Date.now() });
      try {
        const report = await verifyBundle({ ...input, chain: registryReader });
        if (run !== latest.current) return null;
        setState({ phase: 'done', source, report });
        setLatestReport(report);
        return report;
      } catch (error) {
        if (run === latest.current) {
          setState({ phase: 'unreachable', source, message: describeFailure(error) });
        }
        return null;
      }
    },
    [],
  );
  const reset = useCallback(() => {
    latest.current++;
    setState({ phase: 'idle' });
    setLatestReport(null);
  }, []);
  return { state, report: latestReport, verify, reset };
}
