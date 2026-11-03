import { reduceJournal } from '@packout/sdk';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { registryReader } from './chain/clients';
import { Notice } from './components/notice';
import { Rail, type StepState, type View } from './components/rail';
import { registryLookup } from './config/env';
import { gates } from './domain/gating';
import { type AnchoredOp, viewJournal } from './domain/journal-view';
import { reconcilePendingOps } from './domain/pending-ops';
import {
  bundleFromSession,
  forgetWorkspace,
  loadSession,
  type Session,
  saveVerifiedImport,
  sessionKey,
} from './domain/storage';
import { ContinueScreen } from './features/continue/continue-screen';
import { type ImportDraft, ImportScreen } from './features/import/import-screen';
import { ProofPage } from './features/proof/proof-screen';
import { proofHref, useProofRoute } from './features/proof/route';
import { TakeoverScreen } from './features/takeover/takeover-screen';
import { VerifyScreen } from './features/verify/verify-screen';
import { useVerification } from './hooks/use-verification';
import { describeFailure } from './lib/errors';
import { useFocusOnChange } from './lib/focus';

/** Packout Restore: restore a workspace from a bundle, take it over, keep writing. No code path to any vendor. */
export function App() {
  const proofRoute = useProofRoute();
  const onProof = proofRoute !== null;
  const previous = useRef<boolean | undefined>(undefined);
  // Switching pages hides the link that was used: start at the top of the page that appeared.
  useEffect(() => {
    const changed = previous.current !== undefined && previous.current !== onProof;
    previous.current = onProof;
    if (changed) document.getElementById(onProof ? 'proof-main' : 'main')?.focus();
  }, [onProof]);
  return (
    <>
      {proofRoute !== null ? <ProofPage wsIdText={proofRoute} /> : null}
      {/* Stays mounted behind the proof page, so an import in progress survives a look at the proof. */}
      <div hidden={proofRoute !== null}>
        <RestoreApp />
      </div>
    </>
  );
}

function RestoreApp() {
  const session = useLiveQuery(loadSession, []);
  const verification = useVerification();
  const { verify, reset: resetVerification } = verification;
  const account = useAccount();
  const [view, setView] = useState<View | null>(null);
  const [storedError, setStoredError] = useState<string | null>(null);
  const draft = useRef<ImportDraft | null>(null);
  const booted = useRef(false);
  const main = useRef<HTMLElement>(null);
  /** Why the last write was refused. The re-check that follows may replace the screen that showed it. */
  const [writeFailure, setWriteFailure] = useState<string | null>(null);

  async function verifyDevice(start: Session | null) {
    if (!start) return;
    let current = start;
    try {
      // A write whose receipt never reached this tab may still have landed: take it back before checking.
      if (registryReader && (await reconcilePendingOps(registryReader)) > 0) {
        current = (await loadSession()) ?? start;
      }
    } catch {
      // Portaldot could not be asked; the verification below reports that on its own.
    }
    let input: { bundle: unknown; key: Uint8Array };
    try {
      input = { bundle: bundleFromSession(current), key: sessionKey(current.workspace) };
    } catch (error) {
      setStoredError(describeFailure(error));
      return;
    }
    setStoredError(null);
    draft.current = null;
    await verify(input, 'device');
  }

  async function verifyDraft(next: ImportDraft) {
    draft.current = next;
    setWriteFailure(null);
    setView('verify');
    const report = await verify({ bundle: next.text, key: next.key }, 'file');
    if (report?.ok && draft.current === next) {
      await saveVerifiedImport(report, next.key);
      draft.current = null;
    }
  }

  // Resume where the owner left off: a workspace already on this device is re-verified, never trusted blindly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the device has been read
  useEffect(() => {
    if (session === undefined || booted.current) return;
    booted.current = true;
    if (session === null) {
      setView('import');
      return;
    }
    setView(session.workspace.takeover ? 'continue' : 'verify');
    void verifyDevice(session);
  }, [session]);

  const report = verification.report;
  const workspace = session?.workspace ?? null;
  const takenOver = workspace?.takeover != null;
  const g = gates({ report, account: account.address, takenOver });

  const reportViews = useMemo(() => {
    if (!report?.ok || !report.state || !report.ops) return [];
    const ops: AnchoredOp[] = report.ops.map((op, index) => ({ op, index, blockNumber: null }));
    return viewJournal(report.state, ops);
  }, [report]);

  const deviceViews = useMemo(() => {
    if (!session) return [];
    const ops: AnchoredOp[] = session.ops;
    return viewJournal(reduceJournal(ops.map((entry) => entry.op)), ops);
  }, [session]);

  const steps: Record<View, StepState> = {
    import: { done: workspace !== null, open: true },
    verify: { done: report?.ok === true, open: verification.state.phase !== 'idle' },
    takeover: { done: takenOver, open: g.takeoverScreen.open },
    continue: { done: false, open: g.continueScreen.open },
  };

  // A screen the owner may not reach yet falls back to the verification it depends on.
  let active: View = view ?? 'import';
  if (active === 'takeover' && !g.takeoverScreen.open) active = 'verify';
  if (active === 'continue' && !g.continueScreen.open) {
    active = g.takeoverScreen.open ? 'takeover' : 'verify';
  }

  // A new screen replaces the control the user just used: start them at its heading.
  const screenKey =
    view === null
      ? null
      : active === 'verify'
        ? `verify:${verification.state.phase}`
        : `${active}:${takenOver}`;
  useFocusOnChange(screenKey, main, 'h1');

  function rerun() {
    setWriteFailure(null);
    if (draft.current) void verifyDraft(draft.current);
    else void verifyDevice(session ?? null);
  }

  async function refreshDevice() {
    await verifyDevice(await loadSession());
  }

  async function forget() {
    await forgetWorkspace();
    draft.current = null;
    resetVerification();
    setStoredError(null);
    setWriteFailure(null);
    setView('import');
  }

  function renderScreen() {
    if (!registryLookup.ok) {
      return (
        <Notice tone="danger" title="This build cannot check anything">
          {registryLookup.message}
        </Notice>
      );
    }
    if (view === null) return <p className="text-[16px] text-ash">Reading this device…</p>;
    if (active === 'import') {
      return (
        <ImportScreen
          hasWorkspace={workspace !== null}
          onSubmit={(next) => void verifyDraft(next)}
        />
      );
    }
    const onChain = report?.ok ? report.onChain : undefined;
    if (active === 'takeover' && workspace && onChain) {
      return (
        <TakeoverScreen
          workspace={workspace}
          onChain={onChain}
          action={g.takeoverAction}
          onTakenOver={() => void refreshDevice()}
          onContinue={() => setView('continue')}
        />
      );
    }
    if (active === 'continue' && workspace && session && onChain) {
      return (
        <ContinueScreen
          workspace={workspace}
          ops={session.ops}
          views={deviceViews}
          onChain={onChain}
          action={g.writeAction}
          onWriteAttempt={(failure) => {
            setWriteFailure(failure);
            void refreshDevice();
          }}
        />
      );
    }
    return (
      <VerifyScreen
        state={verification.state}
        views={reportViews}
        registry={registryLookup.registry.address}
        takenOver={takenOver}
        hasDevice={workspace !== null}
        onUseDevice={() => {
          setWriteFailure(null);
          void verifyDevice(session ?? null);
        }}
        onRecheck={rerun}
        onChooseAnother={() => setView('import')}
        onNext={() => setView(takenOver ? 'continue' : 'takeover')}
      />
    );
  }

  return (
    <div className="relative isolate min-h-dvh lg:grid lg:grid-cols-[320px_1fr]">
      <a
        href="#main"
        className="baseline sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-signal focus:px-3 focus:py-2 focus:text-[12px] focus:text-signal-ink"
      >
        Skip to content
      </a>
      <Rail
        view={active}
        steps={steps}
        hasWorkspace={workspace !== null}
        onSelect={setView}
        onForget={() => void forget()}
        proofHref={workspace ? proofHref(workspace.wsId) : undefined}
      />
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="px-5 pt-8 pb-20 outline-none lg:px-16 lg:pt-16 lg:pb-28"
      >
        <div className="max-w-[46rem] space-y-10">
          {storedError ? (
            <Notice tone="danger" title="The workspace on this device cannot be read">
              {storedError}
            </Notice>
          ) : null}
          {writeFailure && active !== 'continue' ? (
            <Notice tone="danger" title="Your last write was not anchored">
              {writeFailure}
            </Notice>
          ) : null}
          {renderScreen()}
        </div>
      </main>
    </div>
  );
}
