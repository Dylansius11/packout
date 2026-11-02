import { createRegistryWriter } from '@packout/sdk';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { type UseAccountReturnType, useAccount, useConnect, useDisconnect } from 'wagmi';
import { getWalletClient, switchChain } from 'wagmi/actions';
import { CopyButton } from '@/components/copy-button';
import { DataPath } from '@/components/data-path';
import { FlowSteps } from '@/components/flow-steps';
import { Notice } from '@/components/notice';
import { StepRow, type StepRowStatus } from '@/components/step-row';
import { TxRef } from '@/components/tx-ref';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createVendorApi } from '../../api/vendor-api';
import { publicClient, registryReader } from '../../chain/clients';
import { wagmiConfig } from '../../chain/wagmi';
import { chain, registryLookup, vendorApiUrl } from '../../config/env';
import { db } from '../../db/db';
import type { SetupRecord, SetupStepState } from '../../db/types';
import { buildInviteUrl, keyFromBase64Url } from '../../domain/invite';
import { useNow } from '../../hooks/use-now';
import { restoreFocus, useRestoreFocusWhenIdle } from '../../lib/focus';
import { parseHex32 } from '../../lib/ids';
import { cn } from '../../lib/utils';
import { isSetupComplete, runSetup, SETUP_STEPS } from '../../onboarding/setup-runner';

const api = createVendorApi(vendorApiUrl);
const STALL_MS = 30_000;

function stepDetail(state: SetupStepState, now: number) {
  if (state.status === 'working') {
    const stalled = state.startedAt !== null && now - state.startedAt > STALL_MS;
    return (
      <>
        <p>
          {state.phase === 'wallet'
            ? 'Waiting for your wallet. Confirm the request there.'
            : state.phase === 'submitted'
              ? 'Submitted. Waiting for it to be included in a block.'
              : 'Preparing…'}
        </p>
        {state.txHash ? <TxRef txHash={state.txHash} blockNumber={null} /> : null}
        {stalled ? (
          <p className="text-warning" role="status">
            Still waiting after 30 s. Check your wallet for a pending request and that the network
            is reachable. Nothing is lost: you can reload this page and it resumes here.
          </p>
        ) : null}
      </>
    );
  }
  if (state.status === 'failed') return <p className="text-danger">{state.error}</p>;
  if (state.status === 'done') {
    return (
      <>
        {state.note ? <p>{state.note}</p> : null}
        {state.txHash || state.blockNumber !== null ? (
          <TxRef txHash={state.txHash} blockNumber={state.blockNumber} />
        ) : null}
      </>
    );
  }
  return null;
}

function WalletPanel({ account }: { account: UseAccountReturnType }) {
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const walletAvailable =
    connectors.some((connector) => connector.id !== 'injected') || 'ethereum' in window;

  if (account.isConnected) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface py-1.5 pr-1.5 pl-4 text-sm shadow-card">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-success" />
          <span className="min-w-0">
            Wallet connected: <code className="break-all">{account.address}</code>
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </p>
    );
  }
  if (!walletAvailable) {
    return (
      <Notice tone="warning" title="No browser wallet found">
        Install an EVM wallet such as MetaMask, add the {chain.name} network (chain id {chain.id}),
        then reload this page. Your progress is saved.
      </Notice>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {connectors.map((connector) => (
          <Button
            key={connector.uid}
            onClick={() => connect({ connector, chainId: chain.id })}
            disabled={isPending}
          >
            {connector.id === 'mock' ? 'Connect local test account' : `Connect ${connector.name}`}
          </Button>
        ))}
      </div>
      {isPending ? <p className="text-sm text-muted-foreground">Waiting for your wallet…</p> : null}
      {error ? <p className="text-sm text-danger">{error.message.split('\n')[0]}</p> : null}
    </div>
  );
}

function InvitePanel({
  record,
  headingRef,
}: {
  record: SetupRecord;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  if (!record.wsId || !record.keyB64) return null;
  const link = buildInviteUrl(window.location.origin, record.wsId, keyFromBase64Url(record.keyB64));
  return (
    <section
      aria-labelledby="invite-heading"
      className="state-in space-y-4 rounded-xl border border-success-line bg-success-soft p-5 sm:p-6"
    >
      <h2
        id="invite-heading"
        ref={headingRef}
        tabIndex={-1}
        className="display text-2xl text-success outline-none"
      >
        Member invite link
      </h2>
      <Input
        readOnly
        value={link}
        aria-label="Member invite link"
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-3">
        <CopyButton text={link} label="Copy invite link" />
        <Link to="/w/$wsId" params={{ wsId: record.wsId }} className={cn(buttonVariants())}>
          Open the journal
        </Link>
      </div>
      <p className="text-sm">
        The key is in the part after #, which browsers never send to a server. Anyone with this link
        can read and write the workspace, so share it only with people you trust.
      </p>
    </section>
  );
}

export function SetupPage({ salt }: { salt: string }) {
  const id = parseHex32(salt);
  const record = useLiveQuery(async () => (id ? ((await db.setups.get(id)) ?? null) : null), [id]);
  const account = useAccount();
  const [running, setRunning] = useState(false);
  const now = useNow(running);
  const startRef = useRef<HTMLButtonElement>(null);
  const inviteHeading = useRef<HTMLHeadingElement>(null);
  const complete = record ? isSetupComplete(record) : false;
  const completedHere = useRef(complete);
  // Connecting removes the Connect button and a running setup disables Start: keep keyboard focus on the next action.
  useRestoreFocusWhenIdle(!account.isConnected, startRef);
  useRestoreFocusWhenIdle(running, startRef);
  useEffect(() => {
    if (complete && !completedHere.current) restoreFocus(inviteHeading.current);
    completedHere.current = complete;
  }, [complete]);

  if (record === undefined)
    return <p className="text-sm text-muted-foreground">Reading this setup from the device…</p>;
  if (record === null) {
    return (
      <div className="max-w-2xl space-y-5">
        <h1 className="display text-4xl">Set up a workspace</h1>
        <Notice tone="danger" title="This setup is not on this device">
          Setups are stored in the browser that started them.{' '}
          <Link to="/new" className="font-medium underline underline-offset-2">
            Start a new one
          </Link>
          .
        </Notice>
      </div>
    );
  }
  if (!registryLookup.ok || !registryReader) {
    return (
      <div className="max-w-2xl space-y-5">
        <h1 className="display text-4xl">Set up a workspace</h1>
        <Notice tone="danger" title="Cannot set up a workspace">
          {registryLookup.ok ? 'The registry reader is not available.' : registryLookup.message}
        </Notice>
      </div>
    );
  }
  const reader = registryReader;
  const registry = registryLookup.registry.address;

  async function start(current: SetupRecord) {
    if (!account.address) return;
    setRunning(true);
    try {
      await runSetup(current, {
        api,
        reader,
        account: account.address,
        async writer() {
          if (account.chainId !== chain.id) await switchChain(wagmiConfig, { chainId: chain.id });
          const wallet = await getWalletClient(wagmiConfig, { chainId: chain.id });
          return createRegistryWriter({ wallet, client: publicClient, registry });
        },
      });
    } finally {
      setRunning(false);
    }
  }

  const failed = SETUP_STEPS.some((step) => record.steps[step.id].status === 'failed');
  const started = SETUP_STEPS.some((step) => record.steps[step.id].status !== 'pending');
  const wrongAccount =
    record.ownerAddress !== null &&
    account.address !== undefined &&
    record.ownerAddress.toLowerCase() !== account.address.toLowerCase();

  const doneCount = SETUP_STEPS.filter((step) => record.steps[step.id].status === 'done').length;

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-20">
      <div className="max-w-2xl min-w-0 space-y-8">
        <FlowSteps current={complete ? 2 : 1} />
        <div className="space-y-3">
          <h1 className="display text-4xl md:text-5xl">Set up “{record.label}”</h1>
          <p className="text-muted-foreground">
            Each step shows what really happened. If this page reloads, setup resumes from the first
            unfinished step.
          </p>
        </div>

        {complete ? null : <WalletPanel account={account} />}
        {wrongAccount ? (
          <Notice tone="danger" title="Wrong wallet account">
            This workspace belongs to <code className="break-all">{record.ownerAddress}</code>.
            Switch to that account in your wallet to continue.
          </Notice>
        ) : null}

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="tabular shrink-0">
              {doneCount} of {SETUP_STEPS.length} done
            </span>
            <span
              aria-hidden="true"
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="progress-fill absolute inset-0 rounded-full bg-primary"
                style={{ transform: `scaleX(${doneCount / SETUP_STEPS.length})` }}
              />
            </span>
          </div>
          <ol aria-label="Setup steps">
            {SETUP_STEPS.map((step) => {
              const state = record.steps[step.id];
              const status: StepRowStatus = state.status;
              return (
                <StepRow key={step.id} status={status} title={step.title}>
                  {state.status === 'pending' ? <p>{step.summary}</p> : stepDetail(state, now)}
                </StepRow>
              );
            })}
          </ol>
        </div>

        {complete ? (
          <InvitePanel record={record} headingRef={inviteHeading} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              ref={startRef}
              onClick={() => start(record)}
              disabled={running || !account.isConnected || wrongAccount}
            >
              {running
                ? 'Working…'
                : failed
                  ? 'Try again'
                  : started
                    ? 'Continue setup'
                    : 'Start setup'}
            </Button>
            {!account.isConnected ? (
              <span className="text-sm text-muted-foreground">Connect a wallet to start.</span>
            ) : null}
          </div>
        )}
      </div>
      <aside className="lg:border-l lg:border-border lg:pl-10">
        <DataPath headingId="legend-heading" />
      </aside>
    </div>
  );
}
