import { serializeBundle, type VerificationReport, verifyBundle } from '@packout/sdk';
import { useRef, useState } from 'react';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { registryReader } from '../../chain/clients';
import type { StoredOp, WorkspaceRecord } from '../../db/types';
import { bundleFromSession, sessionKey } from '../../domain/storage';
import { downloadText } from '../../lib/download';
import { describeFailure } from '../../lib/errors';
import { useRestoreFocusWhenIdle } from '../../lib/focus';

type ExportState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'saved'; filename: string; count: number }
  | { phase: 'blocked'; report: VerificationReport }
  | { phase: 'failed'; message: string };

/** The workspace can move again: export what this device holds, but only after it verifies afresh. */
export function ExportPanel({ workspace, ops }: { workspace: WorkspaceRecord; ops: StoredOp[] }) {
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const exportButton = useRef<HTMLButtonElement>(null);
  useRestoreFocusWhenIdle(state.phase === 'checking', exportButton);

  async function run() {
    if (!registryReader) return;
    setState({ phase: 'checking' });
    try {
      const bundle = bundleFromSession({ workspace, ops });
      const report = await verifyBundle({
        bundle,
        key: sessionKey(workspace),
        chain: registryReader,
      });
      if (!report.ok) {
        setState({ phase: 'blocked', report });
        return;
      }
      const filename = `packout-${workspace.wsId.slice(2, 10)}-${bundle.checkpoint.count}ops.bundle.json`;
      downloadText(filename, serializeBundle(bundle));
      setState({ phase: 'saved', filename, count: bundle.checkpoint.count });
    } catch (error) {
      setState({ phase: 'failed', message: describeFailure(error) });
    }
  }

  const blocked =
    state.phase === 'blocked' ? state.report.steps.find((s) => s.status === 'fail') : null;

  return (
    <section aria-labelledby="export-heading" className="space-y-5 border-t border-dust pt-8">
      <h2 id="export-heading" className="baseline depth-0 text-[14px]">
        Export a bundle
      </h2>
      <p className="prose-ash text-[16px]">
        Saves every operation this device holds as a new bundle, so the workspace can move again. It
        is checked against Portaldot first; nothing unverified is offered.
      </p>
      <Button
        ref={exportButton}
        variant="outline"
        onClick={run}
        disabled={state.phase === 'checking'}
      >
        {state.phase === 'checking' ? 'Checking…' : 'Verify and export'}
      </Button>
      {state.phase === 'saved' ? (
        <Notice tone="success" title={`Saved ${state.filename}`}>
          Verified against Portaldot: {state.count} operations. The key is not in the file; keep it
          safe separately.
        </Notice>
      ) : null}
      {blocked ? (
        <Notice tone="danger" title={`Not exported: “${blocked.title}” failed`}>
          {blocked.message}
        </Notice>
      ) : null}
      {state.phase === 'failed' ? (
        <Notice tone="danger" title="Not exported">
          {state.message}
        </Notice>
      ) : null}
    </section>
  );
}
