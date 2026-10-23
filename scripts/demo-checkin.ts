import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createBundle,
  createOp,
  createRegistryReader,
  createRegistryWriter,
  describeRegistryError,
  EVM_DECIMALS,
  envelopeDigest,
  generateWorkspaceKey,
  JOURNAL_SCHEMA_ID,
  type StepId,
  sealOp,
  serializeBundle,
  type TxResult,
  type VerificationReport,
  verifyBundle,
  ZERO_HEAD,
} from '@packout/sdk';
import {
  type Account,
  type Address,
  BaseError,
  bytesToHex,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  type Hex,
  hexToBytes,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  fundingMessage,
  parseDeployment,
  parseNetwork,
  parseTestnetEnv,
  waitForFinalized,
} from './lib/demo.ts';

function printVerification(label: string, report: VerificationReport): void {
  console.log(`\n${label}`);
  for (const step of report.steps) {
    const marker = step.status === 'pass' ? '✔' : step.status === 'fail' ? '✖' : '-';
    console.log(`  ${marker} ${step.title}: ${step.message}`);
  }
}

function requireRefusal(report: VerificationReport, expected: StepId): void {
  if (report.ok || report.steps.find((step) => step.status === 'fail')?.id !== expected) {
    throw new Error(
      `Tampering was not refused at the expected ${expected} check. Do not present this run as successful.`,
    );
  }
}

async function main(): Promise<void> {
  const network = parseNetwork(process.argv.slice(2));
  console.log('PACKOUT — workspace exit check-in');
  console.log(
    network === 'localhost'
      ? 'LOCAL REHEARSAL ONLY — Hardhat development chain; no real Portaldot transactions or test tokens.'
      : 'LIVE PORTALDOT TESTNET — transactions and finality below are read from the configured RPC.',
  );

  let deploymentJson: unknown;
  try {
    deploymentJson = JSON.parse(
      await readFile(new URL(`../contracts/deployments/${network}.json`, import.meta.url), 'utf8'),
    ) as unknown;
  } catch {
    throw new Error(
      `No readable ${network} deployment file. Run pnpm --filter @packout/contracts deploy:${network === 'localhost' ? 'localhost' : 'testnet'} first.`,
    );
  }
  const deployment = parseDeployment(deploymentJson, network);
  const testnetEnv = network === 'portaldotTestnet' ? parseTestnetEnv(process.env) : undefined;
  const rpc = testnetEnv?.PORTALDOT_EVM_RPC ?? 'http://127.0.0.1:8545';
  const chain = defineChain({
    id: network === 'localhost' ? 31337 : 420420777,
    name: network === 'localhost' ? 'Hardhat localhost' : 'Portaldot testnet v3',
    nativeCurrency: { name: 'Test Portaldot', symbol: 'tPOT', decimals: EVM_DECIMALS },
    rpcUrls: { default: { http: [rpc] } },
  });
  const client = createPublicClient({
    chain,
    transport: http(rpc, { timeout: 15_000, retryCount: 0 }),
  });
  const actualChainId = await client.getChainId();
  if (actualChainId !== deployment.chainId || actualChainId !== chain.id) {
    throw new Error(
      `Connected chain ${actualChainId} does not match deployment chain ${deployment.chainId} and selected network ${chain.id}. No transaction was sent.`,
    );
  }
  const code = await client.getCode({ address: deployment.address });
  if (!code || code === '0x')
    throw new Error(
      `No registry contract exists at ${deployment.address}. Deploy to this network first.`,
    );

  let owner: Account | Address;
  let vendor: Account | Address;
  if (testnetEnv) {
    try {
      owner = privateKeyToAccount(testnetEnv.DEPLOYER_PRIVATE_KEY);
      vendor = privateKeyToAccount(testnetEnv.VENDOR_WRITER_PRIVATE_KEY);
    } catch {
      throw new Error(
        'A configured owner or vendor private key is invalid. Correct the root .env before sending transactions.',
      );
    }
  } else {
    const accounts = await createWalletClient({ chain, transport: http(rpc) }).getAddresses();
    if (accounts.length < 2)
      throw new Error('Local rehearsal requires Hardhat default funded accounts #0 and #1.');
    [owner, vendor] = accounts;
  }
  const ownerAddress = typeof owner === 'string' ? owner : owner.address;
  const vendorAddress = typeof vendor === 'string' ? vendor : vendor.address;
  const balances = await Promise.all([
    client.getBalance({ address: ownerAddress }),
    client.getBalance({ address: vendorAddress }),
  ]);
  console.log(
    `Preflight passed: chain ${actualChainId}; registry ${deployment.address} has deployed code.`,
  );
  console.log(
    `Owner ${ownerAddress}: ${formatUnits(balances[0], EVM_DECIMALS)} tPOT${network === 'localhost' ? ' (development units)' : ''}`,
  );
  console.log(
    `Vendor ${vendorAddress}: ${formatUnits(balances[1], EVM_DECIMALS)} tPOT${network === 'localhost' ? ' (development units)' : ''}`,
  );
  if (balances[0] === 0n) throw new Error(fundingMessage('owner', ownerAddress, network));
  if (balances[1] === 0n) throw new Error(fundingMessage('vendor', vendorAddress, network));

  const reader = createRegistryReader({
    client,
    registry: deployment.address,
    fromBlock: BigInt(deployment.blockNumber),
  });
  const ownerWriter = createRegistryWriter({
    client,
    registry: deployment.address,
    wallet: createWalletClient({ account: owner, chain, transport: http(rpc) }),
  });
  const vendorWriter = createRegistryWriter({
    client,
    registry: deployment.address,
    wallet: createWalletClient({ account: vendor, chain, transport: http(rpc) }),
  });
  const blockLink = (block: bigint): string | null =>
    network === 'portaldotTestnet'
      ? `https://scanner-testnet-v3.portaldot.dev/#/blocks/${block}`
      : null;
  const transactions: {
    action: string;
    hash: Hex;
    blockNumber: string;
    finalizedBlock: string;
    gasUsed: string;
    effectiveGasPrice: string;
    feeTPOT: string;
    blockLink: string | null;
  }[] = [];

  async function action<T extends TxResult>(
    label: string,
    send: (hooks: { onSubmitted: (hash: Hex) => void }) => Promise<T>,
  ): Promise<T> {
    console.log(`\n${label}: preparing`);
    const result = await send({
      onSubmitted: (hash) => console.log(`${label}: submitted ${hash}`),
    });
    console.log(`${label}: included in block ${result.blockNumber}`);
    console.log(
      `  Gas used: ${result.gasUsed}; fee: ${formatUnits(result.gasUsed * result.effectiveGasPrice, EVM_DECIMALS)} tPOT`,
    );
    console.log(
      `  ${blockLink(result.blockNumber) ?? `Local RPC block ${result.blockNumber} — no Portaldot explorer link`}`,
    );
    console.log(`${label}: waiting for the RPC finalized block (timeout: 120 seconds)`);
    const finalized = await waitForFinalized(client, result.blockNumber);
    console.log(`${label}: finalized (RPC finalized block ${finalized})`);
    transactions.push({
      action: label,
      hash: result.hash,
      blockNumber: result.blockNumber.toString(),
      finalizedBlock: finalized.toString(),
      gasUsed: result.gasUsed.toString(),
      effectiveGasPrice: result.effectiveGasPrice.toString(),
      feeTPOT: formatUnits(result.gasUsed * result.effectiveGasPrice, EVM_DECIMALS),
      blockLink: blockLink(result.blockNumber),
    });
    return result;
  }

  const created = await action('Create workspace', (hooks) =>
    ownerWriter.createWorkspace(bytesToHex(randomBytes(32)), JOURNAL_SCHEMA_ID, hooks),
  );
  const wsId = created.wsId;
  await action('Grant vendor writer', (hooks) =>
    ownerWriter.grantWriter(wsId, vendorAddress, hooks),
  );
  const dina = { memberId: bytesToHex(randomBytes(16)), name: 'Dina' };
  const rafi = { memberId: bytesToHex(randomBytes(16)), name: 'Rafi' };
  const issue = createOp({
    wsId,
    author: dina,
    type: 'issue.create',
    body: {
      title: 'Migrate billing to the new provider',
      description: 'Keep the workspace history when leaving the vendor.',
    },
  });
  const ops = [
    issue,
    createOp({
      wsId,
      author: rafi,
      type: 'comment.add',
      body: {
        issueId: issue.opId,
        text: 'The history and the right to continue stay with our team.',
      },
    }),
    createOp({
      wsId,
      author: dina,
      type: 'issue.setStatus',
      body: { issueId: issue.opId, status: 'in_progress' },
    }),
  ];
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
  await mkdir(directory, { recursive: true });
  const bundleFile = new URL('bundle.json', directory);
  const keyFile = new URL('key.txt', directory);
  await writeFile(bundleFile, `${serializeBundle(bundle)}\n`);
  await writeFile(keyFile, `${Buffer.from(key).toString('base64url')}\n`, { mode: 0o600 });
  console.log(`\nEncrypted bundle saved on this device: ${fileURLToPath(bundleFile)}`);
  console.log(
    `Workspace key saved separately on this device: ${fileURLToPath(keyFile)} (not printed)`,
  );
  console.log('Verification trusts the configured RPC for Portaldot state and admission events.');
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
