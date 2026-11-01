import type { ReactNode } from 'react';
import { useNow } from '../hooks/use-now';
import { type TxState, txPending } from '../hooks/use-tx';
import { cn } from '../lib/utils';
import { TxRef } from './tx-ref';

const STALL_MS = 30_000;

const STAGES = ['Prepare', 'Wallet', 'Submitted', 'Included'] as const;

const stageOf = { preparing: 0, wallet: 1, submitted: 2, confirmed: 3 } as const;

/**
 * The transaction state machine as one baseline. Stages already passed step back in ash, the stage the
 * action is in sits in front with the caret while it is pending, the rest wait in smoke. Read aloud,
 * the sentence under it says the same thing, so the baseline itself is decoration for the eyes.
 */
function Stages({ at, pending }: { at: number; pending: boolean }) {
  return (
    <ol aria-hidden className="baseline flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
      {STAGES.map((stage, index) => (
        <li
          key={stage}
          className={cn(
            index < at && 'text-ash',
            index === at && 'text-ivory tracking-[0.16em]',
            index > at && 'text-smoke',
            index !== at && 'tracking-[0.08em]',
          )}
        >
          {stage}
          {index === at && pending ? <span className="caret" /> : null}
        </li>
      ))}
    </ol>
  );
}

/** The honest state of one chain action: preparing, waiting for the wallet, submitted, included, or failed. */
export function TxStatus({ state, doneText }: { state: TxState; doneText: ReactNode }) {
  const pending = txPending(state);
  const now = useNow(pending);
  if (state.phase === 'idle') return null;

  if (state.phase === 'failed') {
    return (
      <div role="alert" className="state-in space-y-2">
        <span aria-hidden className="baseline reversed inline-block text-[12px]">
          Failed
        </span>
        <p className="max-w-[62ch] text-[16px] leading-relaxed text-ivory">
          <span className="sr-only">Failed: </span>
          {state.message}
        </p>
      </div>
    );
  }
  if (state.phase === 'confirmed') {
    return (
      <div role="status" className="state-in space-y-3">
        <Stages at={stageOf.confirmed} pending={false} />
        <p className="max-w-[62ch] text-[16px] leading-relaxed text-ivory">{doneText}</p>
        <TxRef txHash={state.hash} blockNumber={state.blockNumber} />
      </div>
    );
  }

  const stalled = now - state.startedAt > STALL_MS;
  return (
    <div role="status" className="space-y-3">
      <Stages at={stageOf[state.phase]} pending />
      <p className="max-w-[62ch] text-[16px] leading-relaxed text-ash">
        {state.phase === 'preparing'
          ? 'Preparing: checking the workspace on Portaldot.'
          : state.phase === 'wallet'
            ? 'Waiting for your wallet. Confirm the request there.'
            : 'Submitted. Waiting for it to be included in a block.'}
      </p>
      {state.phase === 'submitted' ? <TxRef txHash={state.hash} blockNumber={null} /> : null}
      {stalled ? (
        <p className="max-w-[62ch] text-[16px] leading-relaxed text-ivory">
          Still waiting after 30 s. Check your wallet for a pending request and that the network is
          reachable. Nothing is lost.
        </p>
      ) : null}
    </div>
  );
}
