import type { StepResult } from '@packout/sdk';
import { ArrowRight } from '@phosphor-icons/react';
import type { Address } from 'viem';
import { ChainFacts } from '@/components/chain-facts';
import { Notice } from '@/components/notice';
import { PageHead } from '@/components/page-head';
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
    return 'Portaldot has operations this file does not contain. Export a newer bundle from the app that holds the latest history (or from Packout Restore if it wrote last) and import that one.';
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
    return <p className="prose-ash">Import a bundle first: nothing has been checked yet.</p>;
  }

  const label =
    state.source === 'file' ? 'the bundle you imported' : 'the workspace on this device';

  if (state.phase === 'running') {
    return (
      <div className="space-y-8">
        <PageHead title="Verifying" />
        <p role="status" className="baseline depth-0 max-w-[48ch] text-[13px] leading-relaxed">
          Checking {label} against Portaldot via {rpcHost}…
          <span aria-hidden className="caret" />
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
      <div className="space-y-8">
        <PageHead title="Could not reach Portaldot" />
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
    <div className="space-y-14">
      <PageHead title={report.ok ? 'Verified' : 'Verification failed'}>
        <p>
          Checked {label} against Portaldot via {rpcHost}. This app trusts that endpoint for the
          on-chain steps.
        </p>
      </PageHead>

      <ol aria-label="Verification steps" className="space-y-8">
        {report.steps.map((step, index) => (
          <StepRow key={step.id} status={step.status} title={step.title} order={index + 2}>
            <p>{step.message}</p>
          </StepRow>
        ))}
      </ol>

      {failed ? (
        <Notice tone="danger" title={`Blocked: “${failed.title}” failed`}>
          <p>{failed.message}</p>
          {failureHelp(failed) ? <p>{failureHelp(failed)}</p> : null}
          <p>
            Taking over and writing stay locked until every check passes. Nothing was changed on
            Portaldot.
          </p>
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
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
          <section aria-labelledby="workspace-heading" className="space-y-8">
            <h2
              id="workspace-heading"
              className="display text-[clamp(1.5rem,2.6vw,2.25rem)] text-ivory"
            >
              Workspace{props.takenOver ? '' : ' (read-only until you take over)'}
            </h2>
            <IssueList views={props.views} />
          </section>
        </>
      ) : null}
    </div>
  );
}
