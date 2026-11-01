import { DustField, Wordmark } from '@packout/brand';
import type { AppendedEvent } from '@packout/sdk';
import { ArrowLeft } from '@phosphor-icons/react';
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
    <span className="hash tabular break-all text-[13px] text-ivory">
      {address}
      {address.toLowerCase() === owner.toLowerCase() ? (
        <span className="baseline depth-2 ml-3 text-[11px]">owner</span>
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
    <span className="inline-flex items-center gap-3">
      <Button size="sm" variant="outline" onClick={() => void copy()} aria-label={`Copy ${label}`}>
        Copy
      </Button>
      <span role="status" className="text-[14px] text-ash">
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
    <section aria-label="Workspace facts">
      <dl className="grid sm:grid-cols-[11rem_1fr] sm:gap-x-8">
        <Row label="Owner">
          <span className="hash tabular break-all text-[14px] text-ivory">{workspace.owner}</span>
        </Row>
        <Row label="Epoch">
          <span className="hash tabular text-[14px] text-ivory">{workspace.epoch}</span>
        </Row>
        <Row label={`Writers in epoch ${workspace.epoch}`}>
          {writers.length === 0 ? (
            <span className="text-[16px] text-ash">None. Only the owner can write.</span>
          ) : (
            <ul className="space-y-1.5">
              {writers.map((writer) => (
                <li key={writer}>
                  <Who address={writer} owner={workspace.owner} />
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Operations">
          <span className="hash tabular text-[14px] text-ivory">{String(workspace.count)}</span>
        </Row>
        <Row label="Head">
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="hash tabular text-[14px] text-ivory" title={workspace.head}>
              {shortHex(workspace.head)}
            </span>
            <CopyButton value={workspace.head} label="full head" />
          </span>
        </Row>
        <Row label="Registry">
          <span className="hash tabular break-all text-[14px] text-ivory">{registry}</span>
        </Row>
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="baseline depth-2 pt-5 text-[11px] sm:py-3">{label}</dt>
      <dd className="pt-1.5 sm:py-2">{children}</dd>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="display text-[clamp(1.5rem,2.6vw,2.25rem)] text-ivory">
      {children}
    </h2>
  );
}

function AppendList({ data }: { data: ProofData }) {
  const [shown, setShown] = useState(PAGE);
  const newestFirst = useMemo(() => [...data.appended].reverse(), [data.appended]);
  const owner = data.workspace.owner;
  const missing = data.workspace.count - BigInt(data.appended.length);
  return (
    <section aria-labelledby="appends-heading" className="space-y-8">
      <SectionTitle id="appends-heading">Recent appends</SectionTitle>
      {missing !== 0n ? (
        <Notice tone="warning" title="The event history is incomplete">
          The registry counts {String(data.workspace.count)} operations, but {rpcHost} returned{' '}
          {data.appended.length} Appended events. Treat the list below as partial.
        </Notice>
      ) : null}
      {newestFirst.length === 0 ? (
        <p className="prose-ash">Nothing has been appended to this workspace yet.</p>
      ) : (
        <>
          <ol className="space-y-7">
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
    <li className="grid gap-x-8 gap-y-1.5 sm:grid-cols-[6rem_1fr]">
      <p className="baseline depth-0 tabular text-[16px]">#{String(event.index)}</p>
      <div className="min-w-0 space-y-1.5">
        <p className="baseline depth-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[11px]">
          <span>epoch {event.epoch}</span>
          <span>
            digest{' '}
            <code title={event.digest} className="hash text-[12px] normal-case text-ash">
              {shortHex(event.digest)}
            </code>
          </span>
        </p>
        <p className="text-[15px] text-ash">
          Written by <Who address={event.author} owner={owner} />
        </p>
        <TxRef txHash={event.txHash} blockNumber={Number(event.blockNumber)} />
      </div>
    </li>
  );
}

function AddressList({ addresses, owner }: { addresses: readonly Address[]; owner: Address }) {
  return (
    <ul className="mt-1.5 space-y-1.5">
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
        'space-y-2 border-l pl-6',
        rotated && entry.dropped.length > 0 ? 'border-ivory' : 'border-smoke',
      )}
    >
      <p className="baseline depth-0 text-[13px] md:text-[14px]">
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
        <div className="space-y-4 text-[15px]">
          <div>
            <p className="text-ash">
              {entry.writers.length === 0
                ? 'Authorized writers: none, only the owner can write.'
                : 'Authorized writers:'}
            </p>
            {entry.writers.length > 0 ? (
              <AddressList addresses={entry.writers} owner={owner} />
            ) : null}
          </div>
          {entry.dropped.length > 0 ? (
            <div>
              <p className="text-ivory">Lost write access at this block:</p>
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
    <section aria-labelledby="access-heading" className="space-y-8">
      <SectionTitle id="access-heading">Who could write, and when that changed</SectionTitle>
      {timeline.length === 0 ? (
        <p className="prose-ash">No access events were returned for this workspace.</p>
      ) : (
        <ol className="space-y-9">
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
      <div className="space-y-6">
        <p role="status" className="baseline depth-0 max-w-[52ch] text-[13px] leading-relaxed">
          Reading the workspace from Portaldot via {rpcHost}…
          <span aria-hidden className="caret" />
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
    <div className="space-y-20">
      <Facts data={state.data} registry={s.address} />
      <AppendList data={state.data} />
      <AccessTimeline data={state.data} />
      <p className="text-[14px] text-smoke">
        Read up to block {String(state.data.latestBlock)}.{' '}
        <button ref={retryButton} type="button" onClick={retry} className="ghost-link text-[12px]">
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
    <div className="relative isolate min-h-dvh">
      {/* The dust lives behind the header only and is gone before the first row of the ledger. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]"
      >
        <DustField
          className="block h-full w-full"
          anchor="end"
          mirror
          intensity={0.16}
          interactive
        />
        <div className="absolute inset-0 bg-black/70 lg:bg-[linear-gradient(90deg,#000_0%,rgb(0_0_0/0.7)_28%,transparent_60%)]" />
      </div>
      <button
        type="button"
        onClick={() => main.current?.focus()}
        className="baseline sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-signal focus:px-3 focus:py-2 focus:text-[12px] focus:text-signal-ink"
      >
        Skip to content
      </button>
      <header className="px-5 pt-6 lg:px-16 lg:pt-10">
        <div className="mx-auto flex max-w-[60rem] flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <div className="flex items-baseline gap-x-5 text-ivory">
            <Wordmark size={17} />
            <p className="baseline depth-2 text-[12px]">Workspace proof</p>
          </div>
          <a href="#/" className="ghost-link inline-flex min-h-8 items-center gap-2 text-[12px]">
            <ArrowLeft size={14} aria-hidden />
            Back to Packout Restore
          </a>
        </div>
      </header>
      <main
        id="proof-main"
        ref={main}
        tabIndex={-1}
        className="px-5 pt-14 pb-24 outline-none lg:px-16 lg:pt-16 lg:pb-32"
      >
        <div className="mx-auto max-w-[60rem] space-y-20">
          <div className="space-y-5">
            <h1 className="display text-[clamp(2.25rem,5.2vw,4.5rem)] text-ivory">
              Workspace proof
            </h1>
            <p className="prose-ash">
              Read from Portaldot via {rpcHost}. This page trusts that endpoint.
            </p>
            <p className="hash tabular break-all text-[13px] text-ash">{wsId ?? wsIdText}</p>
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
