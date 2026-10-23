import type { StepResult } from '@packout/sdk';
import { ArrowRight, CircleNotch } from '@phosphor-icons/react';
import type { Address } from 'viem';
import { ChainFacts } from '@/components/chain-facts';
import { Notice } from '@/components/notice';
import { StepRow } from '@/components/step-row';
import { Button } from '@/components/ui/button';
import { rpcHost } from '../../config/env';
import type { IssueView } from '../../domain/journal-view';
import { useNow } from '../../hooks/use-now';
import type { VerificationState } from '../../hooks/use-verification';
import { IssueList } from '../workspace/issue-list';

const STALL_MS = 30_000;

function failureHelp(step: StepResult): string | null {
  if (step.id === 'complete') {
    return 'Portaldot has operations this file does not contain. Export a newer bundle from the app that holds the latest history (or from Client B if it wrote last) and import that one.';
  }
  if (step.id === 'anchored') {
    return 'Nothing was changed on Portaldot. Check that this app is pointed at the same network the bundle was exported from.';
  }
  if (step.id === 'decrypt') return 'Check that the key belongs to this workspace.';
  return null;
}

/** Step 2: the six checks, then, only if they all pass, the read-only workspace. */
export function VerifyScreen(props: {
  state: VerificationState;
  views: IssueView[];
  registry: Address;
  takenOver: boolean;
  hasDevice: boolean;
  onUseDevice: () => void;
  onRecheck: () => void;
  onChooseAnother: () => void;
  onNext: () => void;
}) {
  const { state } = props;
  const running = state.phase === 'running';
  const now = useNow(running);

  if (state.phase === 'idle') {
    return (
      <p className="text-sm text-muted-foreground">
        Import a bundle first: nothing has been checked yet.
      </p>
    );
  }

  const label =
    state.source === 'file' ? 'the bundle you imported' : 'the workspace on this device';

  if (state.phase === 'running') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Verifying</h1>
        <p role="status" className="flex items-center gap-2 text-sm">
          <CircleNotch size={18} weight="bold" className="spin text-primary" aria-hidden />
          Checking {label} against Portaldot via {rpcHost}…
        </p>
        {now - state.startedAt > STALL_MS ? (
          <Notice tone="warning" title="Still waiting after 30 s">
            Portaldot at {rpcHost} is slow or unreachable. Nothing is wrong with your bundle yet.
            You can leave this page open, or go back and try again.
          </Notice>
        ) : null}
      </div>
    );
  }

  if (state.phase === 'unreachable') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Could not reach Portaldot</h1>
        <Notice tone="danger" title={`Portaldot via ${rpcHost} did not answer`}>
          {state.message} This is a connection problem, not a verdict on your bundle: nothing was
          marked as failed.
        </Notice>
        <Button onClick={props.onRecheck}>Try again</Button>
      </div>
    );
  }

  const { report } = state;
  const failed = report.steps.find((step) => step.status === 'fail');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{report.ok ? 'Verified' : 'Verification failed'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Checked {label} against Portaldot via {rpcHost}. This app trusts that endpoint for the
          on-chain steps.
        </p>
      </div>

      <ol
        aria-label="Verification steps"
        className="divide-y divide-border rounded-md border border-border bg-surface px-4"
      >
        {report.steps.map((step) => (
          <StepRow key={step.id} status={step.status} title={step.title}>
            <p>{step.message}</p>
          </StepRow>
        ))}
      </ol>

      {failed ? (
        <Notice tone="danger" title={`Blocked: “${failed.title}” failed`}>
          <p>{failed.message}</p>
          {failureHelp(failed) ? <p className="mt-1">{failureHelp(failed)}</p> : null}
          <p className="mt-1">
            Taking over and writing stay locked until every check passes. Nothing was changed on
            Portaldot.
          </p>
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {report.ok ? (
          <Button onClick={props.onNext}>
            {props.takenOver ? 'Continue writing' : 'Continue to take over'}
            <ArrowRight size={16} aria-hidden />
          </Button>
        ) : null}
        {state.source === 'file' && !report.ok ? (
          <Button onClick={props.onChooseAnother}>Choose a different bundle</Button>
        ) : null}
        {state.source === 'file' && !report.ok && props.hasDevice ? (
          <Button variant="outline" onClick={props.onUseDevice}>
            Use the workspace already on this device
          </Button>
        ) : null}
        <Button variant="outline" onClick={props.onRecheck}>
          Check again
        </Button>
      </div>

      {report.ok && report.onChain ? (
        <>
          <ChainFacts onChain={report.onChain} registry={props.registry} />
          <section aria-labelledby="workspace-heading" className="space-y-3">
            <h2 id="workspace-heading" className="text-lg font-semibold">
              Workspace{props.takenOver ? '' : ' (read-only until you take over)'}
            </h2>
            <IssueList views={props.views} />
          </section>
        </>
      ) : null}
    </div>
  );
}
