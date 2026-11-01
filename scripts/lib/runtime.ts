import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Bundle,
  createRegistryReader,
  createRegistryWriter,
  EVM_DECIMALS,
  type JournalState,
  type RegistryReader,
  type RegistryWriter,
  type StepId,
  serializeBundle,
  type TxResult,
  type VerificationReport,
  waitForFinalized,
} from '@packout/sdk';
import {
  type Account,
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  type Hex,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  type DemoDeployment,
  type DemoNetwork,
  fundingMessage,
  parseDeployment,
  parseLocalEnv,
  parseTestnetEnv,
} from './demo.ts';

export interface DemoSession {
  network: DemoNetwork;
  deployment: DemoDeployment;
  chainId: number;
  chain: Chain;
  client: PublicClient;
  vendor: Account | Address;
  vendorAddress: Address;
  vendorWallet: WalletClient;
  reader: RegistryReader;
  ownerWriter: RegistryWriter;
  vendorWriter: RegistryWriter;
}
export interface DemoTransaction {
  action: string;
  hash: Hex;
  blockNumber: string;
  finalizedBlock: string;
  gasUsed: string;
  effectiveGasPrice: string;
  feeTPOT: string;
  blockLink: string | null;
}
export interface DemoActions {
  transactions: DemoTransaction[];
  action<T extends TxResult>(
    label: string,
    send: (hooks: { onSubmitted: (hash: Hex) => void }) => Promise<T>,
  ): Promise<T>;
}

export async function openDemoSession(network: DemoNetwork): Promise<DemoSession> {
  const localEnv = parseLocalEnv(process.env);
  const directory = localEnv.PACKOUT_DEPLOYMENTS_DIR
    ? resolve(localEnv.PACKOUT_DEPLOYMENTS_DIR)
    : fileURLToPath(new URL('../../contracts/deployments/', import.meta.url));
  let deploymentJson: unknown;
  try {
    deploymentJson = JSON.parse(
      await readFile(resolve(directory, `${network}.json`), 'utf8'),
    ) as unknown;
  } catch {
    throw new Error(
      `No readable ${network} deployment file. Run pnpm --filter @packout/contracts deploy:${network === 'localhost' ? 'localhost' : 'testnet'} first.`,
    );
  }
  const deployment = parseDeployment(deploymentJson, network);
  const testnetEnv = network === 'portaldotTestnet' ? parseTestnetEnv(process.env) : undefined;
  const rpc = testnetEnv?.PORTALDOT_EVM_RPC ?? localEnv.LOCAL_RPC_URL;
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
  const ownerWallet = createWalletClient({ account: owner, chain, transport: http(rpc) });
  const vendorWallet = createWalletClient({ account: vendor, chain, transport: http(rpc) });
  const ownerWriter = createRegistryWriter({
    client,
    registry: deployment.address,
    wallet: ownerWallet,
  });
  const vendorWriter = createRegistryWriter({
    client,
    registry: deployment.address,
    wallet: vendorWallet,
  });
  return {
    network,
    deployment,
    chainId: actualChainId,
    chain,
    client,
    vendor,
    vendorAddress,
    vendorWallet,
    reader,
    ownerWriter,
    vendorWriter,
  };
}

export function createDemoActions({
  network,
  client,
}: Pick<DemoSession, 'network' | 'client'>): DemoActions {
  const transactions: DemoTransaction[] = [];
  const blockLink = (block: bigint): string | null =>
    network === 'portaldotTestnet'
      ? `https://scanner-testnet-v3.portaldot.dev/#/blocks/${block}`
      : null;
  return {
    transactions,
    async action(label, send) {
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
    },
  };
}

export function printVerification(label: string, report: VerificationReport): void {
  console.log(`\n${label}`);
  for (const step of report.steps) {
    const marker = step.status === 'pass' ? '✔' : step.status === 'fail' ? '✖' : '-';
    console.log(`  ${marker} ${step.title}: ${step.message}`);
  }
}
export function requireRefusal(report: VerificationReport, expected: StepId): void {
  if (report.ok || report.steps.find((step) => step.status === 'fail')?.id !== expected) {
    throw new Error(
      `Tampering was not refused at the expected ${expected} check. Do not present this run as successful.`,
    );
  }
}
export function requireVerifiedRestore(
  report: VerificationReport,
): asserts report is VerificationReport & { state: JournalState } {
  if (
    !report.ok ||
    !report.state ||
    report.steps.length !== 6 ||
    report.steps.some((step) => step.status !== 'pass')
  ) {
    throw new Error('All six restore checks must pass. Continuing is blocked.');
  }
}
export async function saveDemoBundle(
  directory: URL,
  bundle: Bundle,
  key: Uint8Array,
): Promise<{ bundleFile: URL; keyFile: URL }> {
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
  return { bundleFile, keyFile };
}
