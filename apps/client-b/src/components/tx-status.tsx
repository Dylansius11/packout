import { CheckCircle, CircleNotch, XCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useNow } from '../hooks/use-now';
import { type TxState, txPending } from '../hooks/use-tx';
import { TxRef } from './tx-ref';

const STALL_MS = 30_000;

/** The honest state of one chain action: preparing, waiting for the wallet, submitted, included, or failed. */
export function TxStatus({ state, doneText }: { state: TxState; doneText: ReactNode }) {
  const pending = txPending(state);
  const now = useNow(pending);
  if (state.phase === 'idle') return null;

  if (state.phase === 'failed') {
    return (
      <p role="alert" className="state-in flex gap-2 text-sm text-danger">
        <XCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
        <span>Failed: {state.message}</span>
      </p>
    );
  }
  if (state.phase === 'confirmed') {
    return (
      <div role="status" className="state-in flex gap-2 text-sm text-success">
        <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p>{doneText}</p>
          <TxRef txHash={state.hash} blockNumber={state.blockNumber} />
        </div>
      </div>
    );
  }

  const stalled = now - state.startedAt > STALL_MS;
  return (
    <div role="status" className="space-y-1 text-sm">
      <p className="flex items-center gap-2">
        <CircleNotch size={18} weight="bold" className="spin text-primary" aria-hidden />
        {state.phase === 'preparing'
          ? 'Preparing: checking the workspace on Portaldot.'
          : state.phase === 'wallet'
            ? 'Waiting for your wallet. Confirm the request there.'
            : 'Submitted. Waiting for it to be included in a block.'}
      </p>
      {state.phase === 'submitted' ? <TxRef txHash={state.hash} blockNumber={null} /> : null}
      {stalled ? (
        <p className="text-warning">
          Still waiting after 30 s. Check your wallet for a pending request and that the network is
          reachable. Nothing is lost.
        </p>
      ) : null}
    </div>
  );
}
