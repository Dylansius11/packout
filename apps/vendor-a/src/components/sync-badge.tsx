import { AnchorSimple, CloudArrowUp, Laptop, WarningOctagon } from '@phosphor-icons/react';
import { blockUrl } from '../config/env';
import type { SyncState } from '../domain/sync-state';
import { cn } from '../lib/utils';

const tone = {
  device: 'border-border bg-muted text-foreground',
  vendor: 'border-warning-line bg-warning-soft text-warning',
  anchored: 'border-success-line bg-success-soft text-success',
  rejected: 'border-danger-line bg-danger-soft text-danger',
} as const;

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

const icons = {
  device: Laptop,
  vendor: CloudArrowUp,
  anchored: AnchorSimple,
  rejected: WarningOctagon,
} as const;

/** Where one change lives right now. With `showBlock`, an anchored change links to its block. */
export function SyncBadge({ state, showBlock = false }: { state: SyncState; showBlock?: boolean }) {
  const { label, detail } = describe(state);
  const Icon = icons[state.kind];
  const url =
    state.kind === 'anchored' && state.blockNumber !== null ? blockUrl(state.blockNumber) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-medium',
          tone[state.kind],
        )}
        title={detail}
        data-sync-state={state.kind}
      >
        <Icon size={14} weight="bold" aria-hidden />
        {label}
      </span>
      {showBlock && state.kind === 'anchored' && state.blockNumber !== null ? (
        url ? (
          <a
            className="text-primary underline underline-offset-2"
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
