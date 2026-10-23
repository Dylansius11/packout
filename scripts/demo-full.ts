import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createBundle,
  createOp,
  describeRegistryError,
  envelopeDigest,
  generateWorkspaceKey,
  JOURNAL_SCHEMA_ID,
  RegistryError,
  sealOp,
  verifyBundle,
  ZERO_HEAD,
} from '@packout/sdk';
import { BaseError, bytesToHex } from 'viem';
import { parseNetwork } from './lib/demo.ts';
import { forceRejectedAppend } from './lib/force-rejected.ts';
import { createDemoOperations } from './lib/operations.ts';
import {
  createDemoActions,
  openDemoSession,
  printVerification,
  requireRefusal,
  requireVerifiedRestore,
  saveDemoBundle,
} from './lib/runtime.ts';

async function main(): Promise<void> {
  const network = parseNetwork(process.argv.slice(2));
  console.log('PACKOUT — full workspace exit demo');
  console.log(
    network === 'localhost'
      ? 'LOCAL REHEARSAL ONLY — Hardhat development chain; no real Portaldot transactions or test tokens.'
      : 'LIVE PORTALDOT TESTNET — transactions and finality below are read from the configured RPC.',
  );
  const session = await openDemoSession(network);
  const { reader, ownerWriter, vendorWriter, vendorAddress, deployment } = session;
  const { action, transactions } = createDemoActions(session);
  const { wsId } = await action('Create workspace', (hooks) =>
    ownerWriter.createWorkspace(bytesToHex(randomBytes(32)), JOURNAL_SCHEMA_ID, hooks),
  );
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
  const vendorAppend = await action('Vendor appends 3 operations', (hooks) =>
    vendorWriter.appendBatch(wsId, 0n, ZERO_HEAD, digests, hooks),
  );
  if (
    vendorAppend.appended.length !== 3 ||
    vendorAppend.appended.some(
      (event, index) =>
        event.index !== BigInt(index) ||
        event.digest !== digests[index] ||
        event.author.toLowerCase() !== vendorAddress.toLowerCase(),
    )
  ) {
    throw new Error('The initial operations were not admitted in order under the vendor writer.');
  }
  console.log('Vendor admission verified: indexes 0, 1, 2 were authored by the vendor writer.');
  if (vendorAppend.blockNumber > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('The append block number is too large for bundle v1.');
  const bundle = createBundle({
    chainId: session.chainId,
    registry: deployment.address,
    wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes: sealed.map((envelope) => bytesToHex(envelope)),
    checkpoint: { blockNumber: Number(vendorAppend.blockNumber) },
  });
  const directory = new URL(`../out/demo-full/${wsId.slice(2, 14)}/`, import.meta.url);
  const { bundleFile } = await saveDemoBundle(directory, bundle, key);

  console.log(
    '\nVendor A is shut down for this headless flow: no vendor server is started or called.',
  );
  const restore = await verifyBundle({
    bundle: await readFile(bundleFile, 'utf8'),
    key,
    chain: reader,
  });
  printVerification('Client B restore verification', restore);
  requireVerifiedRestore(restore);
  console.log('\nRestored journal in Client B:');
  for (const issue of restore.state.issues) {
    console.log(`  ${issue.title} — ${issue.status}`);
    for (const comment of issue.comments) console.log(`  ${comment.author.name}: ${comment.text}`);
  }

  await action('Owner takes over with rotateEpoch([])', (hooks) =>
    ownerWriter.rotateEpoch(wsId, [], hooks),
  );
  const takenOver = await reader.getWorkspace(wsId);
  const vendorCanWrite = await reader.canWrite(wsId, vendorAddress);
  if (takenOver?.epoch !== 1 || vendorCanWrite)
    throw new Error('Takeover did not revoke the old vendor writer.');
  console.log(
    `Takeover verified: epoch ${takenOver.epoch}; canWrite(vendor) == ${vendorCanWrite}.`,
  );

  const continuation = sealOp(
    createOp({
      wsId,
      author: ops[0].author,
      type: 'issue.create',
      body: {
        title: 'Continue in Client B',
        description: 'The owner keeps writing after leaving Vendor A.',
      },
    }),
    key,
  );
  const continued = await action('Owner writes Continue in Client B', (hooks) =>
    ownerWriter.appendBatch(
      wsId,
      takenOver.count,
      takenOver.head,
      [envelopeDigest(continuation)],
      hooks,
    ),
  );
  if (continued.appended.length !== 1 || continued.appended[0].index !== 3n)
    throw new Error('Client B continuation was not admitted at index 3.');
  console.log('Client B continuation verified: accepted at index 3.');
  const current = await reader.getWorkspace(wsId);
  if (current?.count !== 4n)
    throw new Error('Workspace history did not continue to four operations.');

  const comeback = sealOp(
    createOp({
      wsId,
      author: ops[1].author,
      type: 'issue.create',
      body: {
        title: 'Vendor comeback write',
        description: 'This unauthorized operation must never enter the workspace.',
      },
    }),
    key,
  );
  const comebackDigests = [envelopeDigest(comeback)];
  console.log('\nVendor comeback through the SDK: preparing and simulating before send');
  let sdkRefused = false;
  try {
    await vendorWriter.appendBatch(wsId, current.count, current.head, comebackDigests, {
      onSubmitted: (hash) => console.log(`Unexpected vendor comeback submission: ${hash}`),
    });
  } catch (error) {
    if (!(error instanceof RegistryError) || error.reason !== 'NotWriter') throw error;
    sdkRefused = true;
    console.log(`Vendor comeback refused before sending: ${describeRegistryError(error)}`);
  }
  if (!sdkRefused)
    throw new Error('The revoked vendor was unexpectedly allowed to write through the SDK.');

  const rejected = await action('Vendor write rejected on-chain', (hooks) =>
    forceRejectedAppend(session, {
      wsId,
      expectedCount: current.count,
      expectedHead: current.head,
      digests: comebackDigests,
      successfulAppendGasUsed: vendorAppend.gasUsed,
      onSubmitted: hooks.onSubmitted,
    }),
  );
  const afterRejection = await reader.getWorkspace(wsId);
  if (
    !afterRejection ||
    afterRejection.count !== current.count ||
    afterRejection.head !== current.head
  )
    throw new Error('The rejected vendor transaction changed workspace history.');

  const stale = await verifyBundle({
    bundle: await readFile(bundleFile, 'utf8'),
    key,
    chain: reader,
  });
  printVerification('Old export verification after Client B continued', stale);
  requireRefusal(stale, 'complete');
  if (!stale.onChain || stale.onChain.count - BigInt(bundle.checkpoint.count) !== 1n)
    throw new Error('The old export was not refused for exactly one missing operation.');
  console.log(
    'Old export is stale: 1 operation missing. Continuing from this old file is blocked.',
  );

  const evidenceFile = new URL('evidence.json', directory);
  await writeFile(
    evidenceFile,
    `${JSON.stringify(
      {
        network,
        chainId: session.chainId,
        registry: deployment.address,
        wsId,
        transactions,
        bundle: fileURLToPath(bundleFile),
        restore: { ok: restore.ok, steps: restore.steps },
        takeover: { epoch: takenOver.epoch, vendorCanWrite },
        continuation: {
          index: '3',
          count: afterRejection.count.toString(),
          head: afterRejection.head,
        },
        vendorRejection: {
          sdkReason: 'NotWriter',
          status: rejected.status,
          hash: rejected.hash,
          blockNumber: rejected.blockNumber.toString(),
          gasLimit: rejected.gasLimit.toString(),
          revertReason: rejected.revertReason,
        },
        staleBundle: { refusedAt: 'complete', missingOperations: 1, steps: stale.steps },
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    '\nSUMMARY — workspace restored; owner continued; vendor write rejected on-chain; old export refused',
  );
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
