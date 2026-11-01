import type { WorkspaceOnChain } from '@packout/sdk';
import type { Address } from 'viem';
import { rpcHost } from '../config/env';
import { shortHex } from '../lib/format';

/** What Portaldot says about this workspace right now, from the registry this build is pointed at. */
export function ChainFacts({
  onChain,
  registry,
}: {
  onChain: WorkspaceOnChain;
  registry: Address;
}) {
  const rows: [string, string, string?][] = [
    ['Owner', onChain.owner],
    ['Epoch', String(onChain.epoch)],
    ['Operations', String(onChain.count)],
    ['Head', shortHex(onChain.head), onChain.head],
    ['Registry', registry],
  ];
  return (
    <section aria-label="Workspace on Portaldot">
      <dl className="grid sm:grid-cols-[8.5rem_1fr] sm:gap-x-6">
        {rows.map(([label, value, title]) => (
          <div key={label} className="contents">
            <dt className="baseline depth-2 pt-4 text-[11px] sm:py-2.5">{label}</dt>
            <dd
              className="hash tabular break-all pt-1 text-[13px] text-ivory sm:py-2"
              title={title}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-smoke">
        Read from Portaldot via {rpcHost}. This app trusts that endpoint for these facts.
      </p>
    </section>
  );
}
