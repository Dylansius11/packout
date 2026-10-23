import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createRegistryReader, createRegistryWriter } from '@packout/sdk';
import {
  type Account,
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  type Hex,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from './app.ts';
import { type Batcher, createBatcher } from './batcher.ts';
import { parseConfig, parseDeployment } from './config.ts';
import { createReceiptLookup } from './receipts.ts';
import { EnvelopeStore } from './store.ts';

const config = parseConfig(process.env);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const deployment = parseDeployment(
  JSON.parse(
    await readFile(
      resolve(
        config.PACKOUT_DEPLOYMENTS_DIR ?? resolve(root, 'contracts/deployments'),
        `${config.PACKOUT_NETWORK}.json`,
      ),
      'utf8',
    ),
  ),
  config.PACKOUT_NETWORK,
);
const rpc =
  config.PACKOUT_NETWORK === 'localhost' ? config.LOCAL_RPC_URL : config.PORTALDOT_EVM_RPC;
const chain = defineChain({
  id: deployment.chainId,
  name: config.PACKOUT_NETWORK,
  nativeCurrency: { name: 'Test Portaldot', symbol: 'tPOT', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const client = createPublicClient({ chain, transport: http(rpc) });
if ((await client.getChainId()) !== chain.id)
  throw new Error('Connected RPC chain id does not match the registry deployment.');
const code = await client.getCode({ address: deployment.address });
if (!code || code === '0x')
  throw new Error(
    'Registry bytecode is missing on the selected chain. Deploy before starting Vendor A.',
  );

let account: Account | Address;
if (config.PACKOUT_NETWORK === 'portaldotTestnet') {
  if (!config.VENDOR_WRITER_PRIVATE_KEY)
    throw new Error('Set VENDOR_WRITER_PRIVATE_KEY before starting Vendor A on testnet.');
  try {
    account = privateKeyToAccount(config.VENDOR_WRITER_PRIVATE_KEY);
  } catch {
    throw new Error('VENDOR_WRITER_PRIVATE_KEY is invalid. Correct it before starting Vendor A.');
  }
} else {
  const addresses = await createWalletClient({ chain, transport: http(rpc) }).getAddresses();
  if (!addresses[1]) throw new Error('Local Vendor A requires Hardhat development account #1.');
  account = addresses[1];
}
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const writerAddress = typeof account === 'string' ? account : account.address;
const reader = createRegistryReader({
  client,
  registry: deployment.address,
  fromBlock: BigInt(deployment.blockNumber),
});
const writer = createRegistryWriter({ client, wallet, registry: deployment.address });
const receipts = createReceiptLookup({ client, registry: deployment.address });
const store = new EnvelopeStore(resolve(root, config.DATABASE_PATH));
const batchers = new Map<Hex, Batcher>();
function startBatcher(wsId: Hex): void {
  if (batchers.has(wsId) || store.getWorkspace(wsId)?.writerState !== 'active') return;
  const batcher = createBatcher({
    store,
    reader,
    writer,
    receipts,
    wsId,
    intervalMs: config.BATCH_INTERVAL_MS,
  });
  batchers.set(wsId, batcher);
  batcher.start();
}
for (const workspace of store.listWorkspaces()) startBatcher(workspace.wsId);
const app = createApp({
  store,
  chain: { ...reader, writer: writerAddress },
  corsOrigin: config.CORS_ORIGIN,
  onWorkspaceRegistered: startBatcher,
});
const server = serve({ fetch: app.fetch, port: config.PORT }, ({ port }) => {
  console.log(`Vendor A API listening on http://localhost:${port}`);
});
let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  const closed = new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  await Promise.all([...batchers.values()].map((batcher) => batcher.stop()));
  await closed;
  store.close();
}
process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
