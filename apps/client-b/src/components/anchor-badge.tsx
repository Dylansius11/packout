import { blockUrl } from '../config/env';
import type { AnchoredOp } from '../domain/journal-view';

/** Where one operation lives: its position in the history Portaldot admitted. A pixel baseline that links to the block. */
export function AnchorBadge({ stored }: { stored: Pick<AnchoredOp, 'index' | 'blockNumber'> }) {
  const url = stored.blockNumber === null ? null : blockUrl(stored.blockNumber);
  return (
    <span className="baseline depth-1 tabular text-[12px]">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="ghost-link">
          Anchored on Portaldot · #{stored.index}
        </a>
      ) : (
        <>Anchored on Portaldot · #{stored.index}</>
      )}
    </span>
  );
}
