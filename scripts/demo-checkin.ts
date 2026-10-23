import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createBundle,
  describeRegistryError,
  envelopeDigest,
  generateWorkspaceKey,
  JOURNAL_SCHEMA_ID,
  sealOp,
  verifyBundle,
  ZERO_HEAD,
} from '@packout/sdk';
import { BaseError, bytesToHex, hexToBytes } from 'viem';
import { parseNetwork } from './lib/demo.ts';
import { createDemoOperations } from './lib/operations.ts';
import {
  createDemoActions,
  openDemoSession,
  printVerification,
  requireRefusal,
  saveDemoBundle,
} from './lib/runtime.ts';

async function main(): Promise<void> {
  const network = parseNetwork(process.argv.slice(2));
  console.log('PACKOUT — workspace exit check-in');
  console.log(
    network === 'localhost'
      ? 'LOCAL REHEARSAL ONLY — Hardhat development chain; no real Portaldot transactions or test tokens.'
      : 'LIVE PORTALDOT TESTNET — transactions and finality below are read from the configured RPC.',
  );

  const session = await openDemoSession(network);
  const {
    deployment,
    reader,
    ownerWriter,
    vendorWriter,
    vendorAddress,
    chainId: actualChainId,
  } = session;
  const { action, transactions } = createDemoActions(session);

  const created = await action('Create workspace', (hooks) =>
    ownerWriter.createWorkspace(bytesToHex(randomBytes(32)), JOURNAL_SCHEMA_ID, hooks),
  );
  const wsId = created.wsId;
  await action('Grant vendor writer', (hooks) =>
    ownerWriter.grantWriter(wsId, vendorAddress, hooks),
  );
  const ops = createDemoOperations(wsId);
  const key = generateWorkspaceKey();
  const sealed = ops.map((op) => sealOp(op, key));
  const digests = sealed.map(envelopeDigest);
  console.log(
    '\nThree member operations encrypted on this device with a fresh workspace key. Members need no wallets.',
  );
  console.log(
    'Only ciphertext digests are sent to Portaldot; plaintext and the workspace key stay on this device.',
  );
  const appended = await action('Vendor appends 3 operations', (hooks) =>
    vendorWriter.appendBatch(wsId, 0n, ZERO_HEAD, digests, hooks),
  );

  console.log('\nReading Appended events from the chain with eth_getLogs:');
  const events = await reader.getAppendedRange(wsId, 0n, 2n);
  if (events.length !== 3)
    throw new Error(`Expected 3 admitted operations but eth_getLogs returned ${events.length}.`);
  for (const [index, event] of events.entries()) {
    if (event.index !== BigInt(index) || event.digest !== digests[index])
      throw new Error(`Portaldot returned different content at operation ${index + 1}.`);
    console.log(`  index ${event.index}; digest ${event.digest}; head ${event.head}`);
  }
  if (appended.blockNumber > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('The append block number is too large for bundle v1.');
  const bundle = createBundle({
    chainId: actualChainId,
    registry: deployment.address,
    wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes: sealed.map((envelope) => bytesToHex(envelope)),
    checkpoint: { blockNumber: Number(appended.blockNumber) },
  });
  const directory = new URL(`../out/demo-checkin/${wsId.slice(2, 14)}/`, import.meta.url);
  const { bundleFile } = await saveDemoBundle(directory, bundle, key);
  const report = await verifyBundle({
    bundle: await readFile(bundleFile, 'utf8'),
    key,
    chain: reader,
  });
  printVerification('Restore verification', report);
  if (!report.ok || !report.state)
    throw new Error('The exported bundle did not verify. Continuing is blocked.');
  console.log('\nReconstructed journal:');
  for (const restored of report.state.issues) {
    console.log(`  ${restored.title} — ${restored.status}`);
    for (const comment of restored.comments)
      console.log(`  ${comment.author.name}: ${comment.text}`);
  }

  const omitted = createBundle({
    ...bundle,
    envelopes: bundle.envelopes.filter((_, index) => index !== 1),
    checkpoint: { blockNumber: bundle.checkpoint.blockNumber },
  });
  const omittedReport = await verifyBundle({ bundle: omitted, key, chain: reader });
  printVerification('Tamper test: removed operation 2 and recomputed count/head', omittedReport);
  requireRefusal(omittedReport, 'anchored');
  const flipped = hexToBytes(bundle.envelopes[0]);
  flipped[25] ^= 1;
  const altered = { ...bundle, envelopes: [bytesToHex(flipped), ...bundle.envelopes.slice(1)] };
  const alteredReport = await verifyBundle({ bundle: altered, key, chain: reader });
  printVerification('Tamper test: flipped one encrypted byte; checkpoint unchanged', alteredReport);
  requireRefusal(alteredReport, 'head');

  const evidenceFile = new URL('evidence.json', directory);
  await writeFile(
    evidenceFile,
    `${JSON.stringify({ network, chainId: actualChainId, registry: deployment.address, wsId, transactions, bundle: fileURLToPath(bundleFile), verified: report.ok, tamperRefusals: { omitted: 'anchored', altered: 'head' } }, null, 2)}\n`,
  );
  console.log('\nSUMMARY — verified history; both tampered copies refused');
  console.log(
    `Network: ${network}${network === 'localhost' ? ' (local rehearsal, not testnet evidence)' : ''}`,
  );
  console.log(`Registry: ${deployment.address}`);
  console.log(`Workspace: ${wsId}`);
  for (const tx of transactions)
    console.log(
      `${tx.action}: ${tx.hash}\n  ${tx.blockLink ?? `Local RPC block ${tx.blockNumber}`}`,
    );
  console.log(`Evidence: ${fileURLToPath(evidenceFile)}`);
}

try {
  await main();
} catch (error) {
  console.error(
    `\nDEMO STOPPED: ${error instanceof BaseError ? error.shortMessage : describeRegistryError(error)}`,
  );
  process.exitCode = 1;
}
