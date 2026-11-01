import type { Hex } from 'viem';
import { blockUrl } from '../config/env';
import { shortHex } from '../lib/format';

/** Transaction hash plus block link. EVM transactions have no explorer page, so the block page stands in. */
export function TxRef({ txHash, blockNumber }: { txHash: Hex | null; blockNumber: number | null }) {
  const url = blockNumber === null ? null : blockUrl(blockNumber);
  return (
    <span className="baseline depth-1 tabular text-[12px]">
      {txHash ? (
        <>
          tx{' '}
          <code title={txHash} className="hash text-[1.1em] normal-case text-ivory">
            {shortHex(txHash)}
          </code>
        </>
      ) : null}
      {blockNumber !== null ? (
        <>
          {txHash ? <span className="text-smoke"> · </span> : ''}
          {url ? (
            <a className="ghost-link" href={url} target="_blank" rel="noreferrer">
              block {blockNumber}
              <span className="sr-only"> on the Portaldot explorer (opens in a new tab)</span>
            </a>
          ) : (
            <>block {blockNumber}</>
          )}
        </>
      ) : null}
    </span>
  );
}
