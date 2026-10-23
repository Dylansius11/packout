import type { Hex } from 'viem';
import { blockUrl } from '../config/env';
import { shortHex } from '../lib/format';

/** Transaction hash plus block link. EVM transactions have no explorer page, so the block page stands in. */
export function TxRef({ txHash, blockNumber }: { txHash: Hex | null; blockNumber: number | null }) {
  const url = blockNumber === null ? null : blockUrl(blockNumber);
  return (
    <span className="tabular font-mono text-xs text-muted-foreground">
      {txHash ? (
        <>
          tx <code title={txHash}>{shortHex(txHash)}</code>
        </>
      ) : null}
      {blockNumber !== null ? (
        <>
          {txHash ? ' · ' : ''}
          {url ? (
            <a
              className="text-primary underline underline-offset-2"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              block {blockNumber}
            </a>
          ) : (
            <>block {blockNumber}</>
          )}
        </>
      ) : null}
    </span>
  );
}
