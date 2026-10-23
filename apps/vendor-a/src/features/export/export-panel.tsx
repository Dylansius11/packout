import type { VerificationReport } from '@packout/sdk';
import { DownloadSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { Notice } from '@/components/notice';
import { StepRow } from '@/components/step-row';
import { Button } from '@/components/ui/button';
import { createVendorApi } from '../../api/vendor-api';
import { publicClient, registryReader } from '../../chain/clients';
import { chain, registryLookup, rpcHost, vendorApiUrl } from '../../config/env';
import { db } from '../../db/db';
import { verifyBeforeExport } from '../../domain/export-bundle';
import { keyFromBase64Url } from '../../domain/invite';
import { anchoredEnvelopes } from '../../domain/journal-order';
import { STALL_MS } from '../../domain/sync-state';
import { useNow } from '../../hooks/use-now';
import { downloadText } from '../../lib/download';
import { describeFailure } from '../../lib/errors';
import { syncWorkspace } from '../../sync/engine';
import { useJournalContext } from '../journal/journal-context';

const api = createVendorApi(vendorApiUrl);

type ExportState =
  | { phase: 'idle' }
  | { phase: 'collecting'; startedAt: number }
  | { phase: 'verifying'; startedAt: number; collected: string }
  | { phase: 'failed'; message: string; collected: string | null }
  | {
      phase: 'verified';
      report: VerificationReport;
      collected: string;
      filename: string;
      json: string;
    }
  | { phase: 'blocked'; report: VerificationReport; collected: string };

export function ExportPanel() {
  const { workspace } = useJournalContext();
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const running = state.phase === 'collecting' || state.phase === 'verifying';
  const now = useNow(running);

  async function runExport() {
    const reader = registryReader;
    if (!registryLookup.ok || !reader) return;
    const key = keyFromBase64Url(workspace.keyB64);
    setState({ phase: 'collecting', startedAt: Date.now() });
    let collected: string | null = null;
    try {
      const outcome = await syncWorkspace(workspace, key, api);
      let { envelopes, missing } = anchoredEnvelopes(
        await db.ops.where('wsId').equals(workspace.wsId).toArray(),
      );
      if (missing.length > 0 && outcome.connection === 'online') {
        await syncWorkspace(workspace, key, api, { fullPull: true });
        ({ envelopes, missing } = anchoredEnvelopes(
          await db.ops.where('wsId').equals(workspace.wsId).toArray(),
        ));
      }
      const notAnchored = await db.ops
        .where('wsId')
        .equals(workspace.wsId)
        .filter((op) => op.status === 'local' || op.status === 'pending')
        .count();
      collected = [
        `Collected ${envelopes.length} anchored ${envelopes.length === 1 ? 'operation' : 'operations'} in Portaldot order.`,
        outcome.connection === 'offline'
          ? 'Vendor A is offline, so this is the copy kept on this device.'
          : '',
        missing.length > 0
          ? `This device is missing position ${missing.map((index) => `#${index}`).join(', ')}.`
          : '',
        notAnchored > 0
          ? `${notAnchored} ${notAnchored === 1 ? 'change is' : 'changes are'} not anchored yet and left out.`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      setState({ phase: 'verifying', startedAt: Date.now(), collected });

      const checkpointBlock = Number(await publicClient.getBlockNumber({ cacheTime: 0 }));
      const result = await verifyBeforeExport({
        wsId: workspace.wsId,
        key,
        chain: reader,
        chainId: chain.id,
        registry: registryLookup.registry.address,
        envelopes,
        checkpointBlock,
      });
      if (result.bundleJson === null) {
        setState({ phase: 'blocked', report: result.report, collected });
        return;
      }
      const filename = `packout-${workspace.wsId.slice(2, 10)}.json`;
      downloadText(filename, result.bundleJson);
      setState({
        phase: 'verified',
        report: result.report,
        collected,
        filename,
        json: result.bundleJson,
      });
    } catch (error) {
      setState({
        phase: 'failed',
        message: `Could not finish the check against Portaldot via ${rpcHost}: ${describeFailure(error)}`,
        collected,
      });
    }
  }

  const report = state.phase === 'verified' || state.phase === 'blocked' ? state.report : null;
  const collected = 'collected' in state ? state.collected : null;
  const stalled = running && now - state.startedAt > STALL_MS;

  return (
    <section aria-labelledby="export-heading" className="space-y-3">
      <h2 id="export-heading" className="text-base font-semibold">
        Export bundle
      </h2>
      <p className="text-sm text-muted-foreground">
        A file with every anchored operation, still encrypted, plus the chain checkpoint it must
        match. It is checked against Portaldot with your key before you can download it.
      </p>
      {registryLookup.ok ? (
        <Button onClick={runExport} disabled={running}>
          <DownloadSimple size={16} weight="bold" aria-hidden />
          {running ? 'Checking…' : 'Export bundle'}
        </Button>
      ) : (
        <Notice tone="danger" title="Export is unavailable">
          {registryLookup.message}
        </Notice>
      )}

      {state.phase !== 'idle' ? (
        <ol
          className="divide-y divide-border rounded-md border border-border bg-surface px-4"
          aria-label="Export checks"
        >
          <StepRow
            title="Collect anchored operations"
            status={
              state.phase === 'collecting' ? 'working' : collected !== null ? 'done' : 'failed'
            }
          >
            {collected ? <p>{collected}</p> : null}
          </StepRow>
          {state.phase === 'verifying' ? (
            <StepRow title="Check against Portaldot" status="working">
              <p>Reading the workspace from {rpcHost}…</p>
            </StepRow>
          ) : null}
          {report?.steps.map((step) => (
            <StepRow
              key={step.id}
              title={step.title}
              status={
                step.status === 'pass' ? 'done' : step.status === 'fail' ? 'failed' : 'skipped'
              }
            >
              <p className={step.status === 'fail' ? 'text-danger' : undefined}>{step.message}</p>
            </StepRow>
          ))}
        </ol>
      ) : null}

      {stalled ? (
        <Notice tone="warning" title="Still working after 30 s">
          Vendor A or the Portaldot RPC ({rpcHost}) is slow to answer. You can wait, or try again in
          a moment.
        </Notice>
      ) : null}
      {state.phase === 'failed' ? (
        <Notice tone="danger" title="Export stopped">
          {state.message}
        </Notice>
      ) : null}
      {state.phase === 'blocked' ? (
        <Notice tone="danger" title="Nothing was downloaded">
          The bundle failed a check above, so it is not offered. Fix what the failed step says and
          export again.
        </Notice>
      ) : null}
      {state.phase === 'verified' ? (
        <div className="space-y-3">
          <Notice tone="success" title={`Verified and downloaded as ${state.filename}`}>
            Every check passed. The file contains no key and no plaintext.
          </Notice>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadText(state.filename, state.json)}
          >
            Download again
          </Button>
          <div className="space-y-2 rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning">
            <p className="font-medium">The workspace key is not in the file.</p>
            <p>
              To open the bundle elsewhere you also need the key. Anyone who has it can read the
              whole workspace, so paste it only into the restore app, never into chat or email.
            </p>
            <CopyButton text={workspace.keyB64} label="Copy key" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
