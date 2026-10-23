import { Anchor } from '@phosphor-icons/react';
import { blockUrl } from '../config/env';
import type { AnchoredOp } from '../domain/journal-view';

/** Where one operation lives: its position in the history Portaldot admitted. */
export function AnchorBadge({ stored }: { stored: Pick<AnchoredOp, 'index' | 'blockNumber'> }) {
  const url = stored.blockNumber === null ? null : blockUrl(stored.blockNumber);
  return (
    <span className="tabular inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Anchor size={14} aria-hidden />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Anchored on Portaldot · #{stored.index}
        </a>
      ) : (
        <>Anchored on Portaldot · #{stored.index}</>
      )}
    </span>
  );
}
