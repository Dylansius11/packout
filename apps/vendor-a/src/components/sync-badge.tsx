import { blockUrl } from '../config/env';
import type { SyncState } from '../domain/sync-state';
import { cn } from '../lib/utils';

type Tone = 'device' | 'vendor' | 'anchored' | 'rejected' | 'stalled';

const tone: Record<Tone, string> = {
  device: 'border-border-strong bg-muted text-foreground',
  vendor: 'border-transit-line bg-transit-soft text-transit',
  anchored: 'border-success-line bg-success-soft text-success',
  rejected: 'border-danger-line bg-danger-soft text-danger',
  stalled: 'border-warning-line bg-warning-soft text-warning',
};

function describe(state: SyncState): { label: string; detail: string } {
  switch (state.kind) {
    case 'device':
      return {
        label: state.stalled ? 'On this device · not sent after 30 s' : 'On this device',
        detail: state.stalled
          ? 'Vendor A has not accepted this yet. It stays on this device and is retried automatically.'
          : 'Encrypted and saved on this device. Not yet accepted by Vendor A.',
      };
    case 'vendor':
      return {
        label: state.stalled ? 'Sent to vendor · not anchored after 30 s' : 'Sent to vendor',
        detail: state.stalled
          ? 'Vendor A holds this but Portaldot has not confirmed it after 30 s. The chain may be slow.'
          : 'Vendor A holds the encrypted operation and will anchor it on Portaldot.',
      };
    case 'anchored':
      return {
        label: `Anchored on Portaldot · #${state.index}`,
        detail: `Position ${state.index} in the workspace history on Portaldot.${state.txHash ? ` Transaction ${state.txHash}.` : ''}`,
      };
    case 'rejected':
      return {
        label: `Rejected: ${state.reason}`,
        detail: 'Portaldot or Vendor A refused this operation. It exists only on this device.',
      };
  }
}

/** How far along the path device, vendor, Portaldot a change got. Decorative: the label says it in words. */
const REACHED = { device: 1, vendor: 2, anchored: 3, rejected: 1 } as const;

function toneOf(state: SyncState): Tone {
  if ((state.kind === 'device' || state.kind === 'vendor') && state.stalled) return 'stalled';
  return state.kind;
}

/** Where one change lives right now. With `showBlock`, an anchored change links to its block. */
export function SyncBadge({ state, showBlock = false }: { state: SyncState; showBlock?: boolean }) {
  const { label, detail } = describe(state);
  const url =
    state.kind === 'anchored' && state.blockNumber !== null ? blockUrl(state.blockNumber) : null;
  const reached = REACHED[state.kind];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        key={state.kind}
        className={cn(
          'chip-in inline-flex items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-2 font-medium leading-5 transition-colors duration-200',
          tone[toneOf(state)],
        )}
        title={detail}
        data-sync-state={state.kind}
      >
        <span aria-hidden="true" className="flex shrink-0 gap-0.5">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={cn(
                'h-[3px] w-2.5 rounded-full bg-current transition-opacity duration-300',
                step <= reached ? 'opacity-100' : 'opacity-25',
              )}
            />
          ))}
        </span>
        {label}
      </span>
      {showBlock && state.kind === 'anchored' && state.blockNumber !== null ? (
        url ? (
          <a
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-2 md:min-h-0"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            Block {state.blockNumber}
          </a>
        ) : (
          <span className="text-muted-foreground">Block {state.blockNumber}</span>
        )
      ) : null}
    </span>
  );
}
