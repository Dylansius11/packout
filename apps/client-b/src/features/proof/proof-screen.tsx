import type { AppendedEvent } from '@packout/sdk';
import { ArrowLeft, Check, CircleNotch, Copy } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Address, Hex } from 'viem';
import { Notice } from '@/components/notice';
import { TxRef } from '@/components/tx-ref';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { publicClient, registryReader } from '../../chain/clients';
import { registryLookup, rpcHost } from '../../config/env';
import { useNow } from '../../hooks/use-now';
import { restoreFocus } from '../../lib/focus';
import { shortHex } from '../../lib/format';
import { buildTimeline, currentWriters, parseWorkspaceId, type TimelineEntry } from './history';
import type { ProofData, ProofSource } from './load-proof';
import { useProof } from './use-proof';

const SLOW_MS = 10_000;
const PAGE = 20;

const source: ProofSource | null =
  registryLookup.ok && registryReader
    ? {
        client: publicClient,
        reader: registryReader,
        address: registryLookup.registry.address,
        fromBlock: registryLookup.registry.fromBlock,
      }
    : null;

function Who({ address, owner }: { address: Address; owner: Address }) {
  return (
    <span className="tabular break-all font-mono text-xs">
      {address}
      {address.toLowerCase() === owner.toLowerCase() ? (
        <span className="ml-2 rounded-sm border border-input px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
          owner
        </span>
      ) : null}
    </span>
  );
}

/** Copies the full value; says so, or says why it could not. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [outcome, setOutcome] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setOutcome('copied');
    } catch {
      setOutcome('failed');
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className="h-7 px-2 text-xs"
      >
        {outcome === 'copied' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        Copy
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {outcome === 'copied'
          ? 'Copied'
          : outcome === 'failed'
            ? 'The browser blocked copying.'
            : ''}
      </span>
    </span>
  );
}

function Facts({ data, registry }: { data: ProofData; registry: Address }) {
  const { workspace } = data;
  const writers = useMemo(
    () => currentWriters(data.access, workspace.epoch),
    [data.access, workspace.epoch],
  );
  return (
    <section aria-label="Workspace facts" className="rounded-md border border-border bg-surface">
      <dl className="grid sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <Row label="Owner">
          <span className="tabular break-all font-mono text-sm">{workspace.owner}</span>
        </Row>
        <Row label="Epoch">
          <span className="tabular font-mono text-sm">{workspace.epoch}</span>
        </Row>
        <Row label={`Writers in epoch ${workspace.epoch}`}>
          {writers.length === 0 ? (
            <span className="text-sm">None. Only the owner can write.</span>
          ) : (
            <ul className="space-y-1">
              {writers.map((writer) => (
                <li key={writer}>
                  <Who address={writer} owner={workspace.owner} />
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Operations">
          <span className="tabular font-mono text-sm">{String(workspace.count)}</span>
        </Row>
        <Row label="Head">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular font-mono text-sm" title={workspace.head}>
              {shortHex(workspace.head)}
            </span>
            <CopyButton value={workspace.head} label="full head" />
          </span>
        </Row>
        <Row label="Registry">
          <span className="tabular break-all font-mono text-sm">{registry}</span>
        </Row>
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground sm:py-2.5">
        {label}
      </dt>
      <dd className="px-4 pb-3 sm:py-2">{children}</dd>
    </div>
  );
}

function AppendList({ data }: { data: ProofData }) {
  const [shown, setShown] = useState(PAGE);
  const newestFirst = useMemo(() => [...data.appended].reverse(), [data.appended]);
  const owner = data.workspace.owner;
  const missing = data.workspace.count - BigInt(data.appended.length);
  return (
    <section aria-labelledby="appends-heading" className="space-y-3">
      <h2 id="appends-heading" className="text-lg font-semibold">
        Recent appends
      </h2>
      {missing !== 0n ? (
        <Notice tone="warning" title="The event history is incomplete">
          The registry counts {String(data.workspace.count)} operations, but {rpcHost} returned{' '}
          {data.appended.length} Appended events. Treat the list below as partial.
        </Notice>
      ) : null}
      {newestFirst.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Nothing has been appended to this workspace yet.
        </p>
      ) : (
        <>
          <ol className="divide-y divide-border rounded-md border border-border bg-surface">
            {newestFirst.slice(0, shown).map((event) => (
              <AppendRow key={event.index.toString()} event={event} owner={owner} />
            ))}
          </ol>
          {newestFirst.length > shown ? (
            <Button variant="outline" size="sm" onClick={() => setShown(shown + PAGE)}>
              Show older appends ({newestFirst.length - shown} more)
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

function AppendRow({ event, owner }: { event: AppendedEvent; owner: Address }) {
  return (
    <li className="space-y-1.5 px-4 py-3">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular font-mono text-sm font-medium">#{String(event.index)}</span>
        <span className="text-xs text-muted-foreground">epoch {event.epoch}</span>
        <span className="text-xs text-muted-foreground">
          digest <code title={event.digest}>{shortHex(event.digest)}</code>
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        Written by <Who address={event.author} owner={owner} />
      </p>
      <TxRef txHash={event.txHash} blockNumber={Number(event.blockNumber)} />
    </li>
  );
}

function AddressList({ addresses, owner }: { addresses: readonly Address[]; owner: Address }) {
  return (
    <ul className="mt-1 space-y-1">
      {addresses.map((address) => (
        <li key={address}>
          <Who address={address} owner={owner} />
        </li>
      ))}
    </ul>
  );
}

function TimelineItem({ entry, owner }: { entry: TimelineEntry; owner: Address }) {
  const rotated = entry.kind === 'rotated';
  return (
    <li
      className={cn(
        'space-y-1.5 border-l-2 py-3 pl-4 pr-4',
        rotated && entry.dropped.length > 0 ? 'border-warning-line' : 'border-border',
      )}
    >
      <p className="text-sm font-medium">
        {entry.kind === 'created' && 'Workspace created'}
        {entry.kind === 'granted' && `Writer authorized in epoch ${entry.epoch}`}
        {entry.kind === 'revoked' && `Writer revoked in epoch ${entry.epoch}`}
        {entry.kind === 'rotated' && `Epoch ${entry.epoch} began`}
      </p>
      {entry.kind === 'created' ? (
        <div>
          <Who address={entry.owner} owner={owner} />
        </div>
      ) : null}
      {entry.kind === 'granted' || entry.kind === 'revoked' ? (
        <div>
          <Who address={entry.writer} owner={owner} />
        </div>
      ) : null}
      {entry.kind === 'rotated' ? (
        <div className="space-y-2 text-xs">
          <div>
            <p className="text-muted-foreground">
              {entry.writers.length === 0
                ? 'Authorized writers: none, only the owner can write.'
                : 'Authorized writers:'}
            </p>
            {entry.writers.length > 0 ? (
              <AddressList addresses={entry.writers} owner={owner} />
            ) : null}
          </div>
          {entry.dropped.length > 0 ? (
            <div className="text-warning">
              <p>Lost write access at this block:</p>
              <AddressList addresses={entry.dropped} owner={owner} />
            </div>
          ) : null}
        </div>
      ) : null}
      <TxRef txHash={entry.txHash} blockNumber={Number(entry.blockNumber)} />
    </li>
  );
}

function AccessTimeline({ data }: { data: ProofData }) {
  const timeline = useMemo(() => buildTimeline(data.access), [data.access]);
  return (
    <section aria-labelledby="access-heading" className="space-y-3">
      <h2 id="access-heading" className="text-lg font-semibold">
        Who could write, and when that changed
      </h2>
      {timeline.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No access events were returned for this workspace.
        </p>
      ) : (
        <ol className="rounded-md border border-border bg-surface px-1">
          {timeline.map((entry) => (
            <TimelineItem
              key={`${entry.blockNumber}-${entry.logIndex}`}
              entry={entry}
              owner={data.workspace.owner}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function Loaded({ wsId, source: s }: { wsId: Hex; source: ProofSource }) {
  const { state, reload } = useProof(s, wsId);
  const loading = state.phase === 'loading';
  const now = useNow(loading);
  const retryButton = useRef<HTMLButtonElement>(null);
  const retried = useRef(false);
  // Reading again replaces the button that asked for it; hand focus to the one that replaces it.
  useEffect(() => {
    if (loading || !retried.current) return;
    retried.current = false;
    restoreFocus(retryButton.current);
  }, [loading]);
  function retry() {
    retried.current = true;
    reload();
  }

  if (state.phase === 'loading') {
    return (
      <div className="space-y-3">
        <p role="status" className="flex items-center gap-2 text-sm">
          <CircleNotch size={18} weight="bold" className="spin text-primary" aria-hidden />
          Reading the workspace from Portaldot via {rpcHost}…
        </p>
        {now - state.startedAt > SLOW_MS ? (
          <Notice tone="warning" title="Still waiting after 10 s">
            Portaldot at {rpcHost} is slow or unreachable. Nothing has been shown because nothing
            has been read. You can keep waiting or try again.
            <div className="mt-3">
              <Button ref={retryButton} size="sm" variant="outline" onClick={retry}>
                Try again
              </Button>
            </div>
          </Notice>
        ) : null}
      </div>
    );
  }
  if (state.phase === 'error') {
    return (
      <Notice tone="danger" title={`Portaldot via ${rpcHost} could not be read`}>
        {state.message} Nothing was shown because nothing could be verified.
        <div className="mt-3">
          <Button ref={retryButton} size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      </Notice>
    );
  }
  if (state.phase === 'unknown') {
    return (
      <Notice tone="warning" title="No workspace with this id">
        The registry at {s.address} has no workspace with this id. Check the id for typos, and that
        this page is pointed at the network the workspace was created on.
      </Notice>
    );
  }
  return (
    <div className="space-y-8">
      <Facts data={state.data} registry={s.address} />
      <AppendList data={state.data} />
      <AccessTimeline data={state.data} />
      <p className="text-xs text-muted-foreground">
        Read up to block {String(state.data.latestBlock)}.{' '}
        <button
          ref={retryButton}
          type="button"
          onClick={retry}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Read again
        </button>
      </p>
    </div>
  );
}

/** Public, read-only: what Portaldot says about one workspace. No bundle, no key, no wallet. */
export function ProofPage({ wsIdText }: { wsIdText: string }) {
  const wsId = parseWorkspaceId(wsIdText);
  const main = useRef<HTMLElement>(null);
  return (
    <div className="min-h-dvh">
      <button
        type="button"
        onClick={() => main.current?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </button>
      <header className="border-b border-border bg-rail px-4 py-4 lg:px-12">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xl font-semibold tracking-tight">Client B</p>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Workspace proof
            </p>
          </div>
          <a
            href="#/"
            className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to Client B
          </a>
        </div>
      </header>
      <main
        id="proof-main"
        ref={main}
        tabIndex={-1}
        className="px-4 py-8 outline-none lg:px-12 lg:py-12"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Workspace proof</h1>
            <p className="text-sm text-muted-foreground">
              Read from Portaldot via {rpcHost}. This page trusts that endpoint.
            </p>
            <p className="tabular break-all font-mono text-xs text-muted-foreground">
              {wsId ?? wsIdText}
            </p>
          </div>
          {!registryLookup.ok ? (
            <Notice tone="danger" title="This build cannot check anything">
              {registryLookup.message}
            </Notice>
          ) : wsId === null || source === null ? (
            <Notice tone="warning" title="That is not a workspace id">
              A workspace id is 0x followed by 64 hexadecimal characters. Nothing was read from
              Portaldot.
            </Notice>
          ) : (
            <Loaded key={wsId} wsId={wsId} source={source} />
          )}
        </div>
      </main>
    </div>
  );
}
