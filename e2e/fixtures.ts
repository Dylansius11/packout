import { createRegistryReader, createRegistryWriter } from '@packout/sdk';
import { type APIRequestContext, test as base, expect } from '@playwright/test';
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { parseDeployment } from '../scripts/lib/demo.ts';
import type { DemoSession } from '../scripts/lib/runtime.ts';
import { RPC_URL } from './helpers.ts';

type VendorProcess = { stop: () => Promise<void>; start: () => Promise<void> };

export const test = base.extend<{ vendorProcess: VendorProcess }>({
  vendorProcess: async ({ request }, use) => {
    async function control(action: 'stop' | 'start') {
      const response = await request.post(`/__e2e/vendor/${action}`, {
        headers: { 'x-packout-e2e': '1' },
      });
      expect(response.ok(), await response.text()).toBe(true);
      expect(await response.json()).toEqual({ running: action === 'start' });
    }
    try {
      await use({ stop: () => control('stop'), start: () => control('start') });
    } finally {
      // Restore the real process even on failure, so the separate Phase 4 spec remains independent.
      await control('start');
    }
  },
});

export async function localDemoSession(request: APIRequestContext): Promise<DemoSession> {
  const response = await request.get('/__e2e/deployment', { headers: { 'x-packout-e2e': '1' } });
  expect(response.ok()).toBe(true);
  const deployment = parseDeployment(await response.json(), 'localhost');
  const chain = hardhat;
  const client = createPublicClient({ chain, transport: http(RPC_URL) });
  const chainId = await client.getChainId();
  expect(chainId).toBe(31337);
  expect(deployment.chainId).toBe(chainId);
  const accounts = await createWalletClient({ chain, transport: http(RPC_URL) }).getAddresses();
  const [owner, vendor] = accounts;
  expect(owner).toBeDefined();
  expect(vendor).toBeDefined();
  const ownerWallet = createWalletClient({ account: owner, chain, transport: http(RPC_URL) });
  const vendorWallet = createWalletClient({ account: vendor, chain, transport: http(RPC_URL) });
  const reader = createRegistryReader({
    client,
    registry: deployment.address,
    fromBlock: BigInt(deployment.blockNumber),
  });
  return {
    network: 'localhost',
    deployment,
    chainId,
    chain,
    client,
    vendor,
    vendorAddress: vendor,
    vendorWallet,
    reader,
    ownerWriter: createRegistryWriter({
      client,
      registry: deployment.address,
      wallet: ownerWallet,
    }),
    vendorWriter: createRegistryWriter({
      client,
      registry: deployment.address,
      wallet: vendorWallet,
    }),
  };
}
