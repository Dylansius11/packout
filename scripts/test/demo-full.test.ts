import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createBundle,
  generateWorkspaceKey,
  JOURNAL_SCHEMA_ID,
  openEnvelope,
  reduceJournal,
  sealOp,
  type VerificationReport,
} from '@packout/sdk';
import { bytesToHex } from 'viem';
import { test } from 'vitest';
import { parseLocalEnv } from '../lib/demo.ts';
import { decodedRevert, submittedHashFromError } from '../lib/force-rejected.ts';
import { createDemoOperations } from '../lib/operations.ts';
import { requireRefusal, requireVerifiedRestore, saveDemoBundle } from '../lib/runtime.ts';

const wsId = `0x${'11'.repeat(32)}` as const;
const address = `0x${'22'.repeat(20)}` as const;
const txHash = `0x${'33'.repeat(32)}` as const;

test('local demo configuration honors an isolated RPC and deployment directory', () => {
  assert.equal(parseLocalEnv({}).LOCAL_RPC_URL, 'http://127.0.0.1:8545');
  assert.deepEqual(
    parseLocalEnv({
      LOCAL_RPC_URL: 'http://127.0.0.1:18545',
      PACKOUT_DEPLOYMENTS_DIR: '/isolated/deployments',
    }),
    { LOCAL_RPC_URL: 'http://127.0.0.1:18545', PACKOUT_DEPLOYMENTS_DIR: '/isolated/deployments' },
  );
  assert.throws(() => parseLocalEnv({ LOCAL_RPC_URL: 'not a URL' }), /LOCAL_RPC_URL/);
  assert.throws(() => parseLocalEnv({ LOCAL_RPC_URL: 'file:///not-an-rpc' }), /LOCAL_RPC_URL/);
});

test('uses only a structured RPC transaction hash when send reports an already-mined failure', () => {
  const rpc = Object.assign(new Error('execution reverted'), { data: { txHash } });
  assert.equal(submittedHashFromError(new Error('send failed', { cause: rpc })), txHash);
  assert.equal(submittedHashFromError(new Error(`transaction ${txHash}`)), null);
  assert.equal(
    submittedHashFromError(Object.assign(new Error('invalid'), { data: { txHash: '0x1234' } })),
    null,
  );
});

test('reports decoded contract revert information without inventing a reason', () => {
  const revert = Object.assign(new Error('reverted'), {
    name: 'ContractFunctionRevertedError',
    data: { errorName: 'NotWriter', args: [wsId, address, 1] },
  });
  assert.equal(
    decodedRevert(new Error('call failed', { cause: revert })),
    `NotWriter(${wsId}, ${address}, 1)`,
  );
  assert.equal(decodedRevert(new Error('RPC omitted revert data')), null);
});

test('requires all six restore checks and refuses success or failure at the wrong step', () => {
  const report: VerificationReport = {
    ok: true,
    steps: (['format', 'envelopes', 'head', 'anchored', 'complete', 'decrypt'] as const).map(
      (id) => ({ id, title: id, status: 'pass', message: 'Verified.' }),
    ),
    state: { issues: [], orphans: [] },
  };
  assert.doesNotThrow(() => requireVerifiedRestore(report));
  assert.throws(
    () => requireVerifiedRestore({ ...report, steps: report.steps.slice(0, 5) }),
    /six|6/i,
  );
  assert.throws(() => requireRefusal(report, 'complete'), /expected complete/);
  const stale: VerificationReport = {
    ...report,
    ok: false,
    steps: report.steps.map((step) =>
      step.id === 'complete'
        ? {
            ...step,
            status: 'fail',
            message: 'This bundle is stale: 1 operation is missing from this file.',
          }
        : step,
    ),
  };
  assert.doesNotThrow(() => requireRefusal(stale, 'complete'));
  assert.throws(() => requireRefusal(stale, 'anchored'), /expected anchored/);
});

test('exports ciphertext plus a separate local key that restores the three-member-operation journal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'packout-full-demo-'));
  try {
    const key = generateWorkspaceKey();
    const ops = createDemoOperations(wsId);
    const envelopes = ops.map((op) => bytesToHex(sealOp(op, key)));
    const bundle = createBundle({
      chainId: 31337,
      registry: address,
      wsId,
      schemaId: JOURNAL_SCHEMA_ID,
      envelopes,
      checkpoint: { blockNumber: 3 },
    });
    const files = await saveDemoBundle(pathToFileURL(`${directory}/`), bundle, key);
    const exported = JSON.parse(await readFile(files.bundleFile, 'utf8'));
    const localKey = Buffer.from((await readFile(files.keyFile, 'utf8')).trim(), 'base64url');
    assert.equal(exported.envelopes.length, 3);
    assert.equal(Object.hasOwn(exported, 'key'), false);
    const restored = reduceJournal(
      envelopes.map((envelope) =>
        openEnvelope(Buffer.from(envelope.slice(2), 'hex'), localKey, wsId),
      ),
    );
    assert.equal(restored.issues.length, 1);
    assert.equal(restored.issues[0].status, 'in_progress');
    assert.equal(restored.issues[0].comments.length, 1);
    assert.equal(restored.orphans.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
