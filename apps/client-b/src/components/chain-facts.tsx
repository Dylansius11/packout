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
    <section
      aria-label="Workspace on Portaldot"
      className="rounded-md border border-border bg-surface"
    >
      <dl className="grid sm:grid-cols-[auto_1fr] sm:gap-x-6">
        {rows.map(([label, value, title]) => (
          <div key={label} className="contents">
            <dt className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground sm:py-2">
              {label}
            </dt>
            <dd className="tabular break-all px-4 pb-3 font-mono text-sm sm:py-2" title={title}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Read from Portaldot via {rpcHost}. This app trusts that endpoint for these facts.
      </p>
    </section>
  );
}
