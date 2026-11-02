import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createRegistryReader, packoutRegistryAbi, parseBundle } from '@packout/sdk';
import { expect, type Page, test } from '@playwright/test';
import { createWalletClient, formatEther, type Hex, http, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';
import { decodedRevert } from '../scripts/lib/force-rejected.ts';
import { writeThreeMemberOps } from './helpers.ts';
import { client, installOwnerWallet, shortError, TESTNET_RPC, testnet } from './testnet-wallet.ts';

// From the repository root: pnpm e2e:testnet (install Playwright Chromium first).
// Requires a funded DEPLOYER_PRIVATE_KEY in root .env; node --env-file-if-exists loads it.
// Funds a fresh in-memory owner with 25 tPOT for storage deposits; refunds the remainder best-effort.
// Drives only the real hosted apps and testnet, with no ?e2e=1. Excluded from default pnpm e2e/CI.
// Public hashes, phase timings and finality observations go to out/testnet-e2e/<timestamp>/evidence.json.
const deployerKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .safeParse(process.env.DEPLOYER_PRIVATE_KEY);
if (!deployerKey.success)
  throw new Error(
    'DEPLOYER_PRIVATE_KEY is missing or invalid. Put it in root .env and run pnpm e2e:testnet.',
  );
const deployer = privateKeyToAccount(deployerKey.data as Hex);
const VENDOR_URL = 'https://packout-vendor-a.vercel.app';
const RESTORE_URL = 'https://packout-restore.vercel.app';
const API_URL = 'https://packout-api.43.129.38.115.sslip.io';
const REGISTRY = '0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0';
const VENDOR_WRITER = '0x651dBB5965c6538AbC4027bEFAc3523FF28fF1a0';

test('hosted workspace survives an independent testnet takeover and refuses the vendor', async ({
  browser,
  request,
}, testInfo) => {
  const startedAt = new Date().toISOString();
  const evidenceDir = resolve(
    import.meta.dirname,
    '../out/testnet-e2e',
    startedAt.replaceAll(':', '-'),
  );
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = resolve(evidenceDir, 'evidence.json');
  const owner = privateKeyToAccount(generatePrivateKey());
  const wallet = createWalletClient({
    account: owner,
    chain: testnet,
    transport: http(TESTNET_RPC),
  });
  const funder = createWalletClient({
    account: deployer,
    chain: testnet,
    transport: http(TESTNET_RPC),
  });
  const reader = createRegistryReader({ client, registry: REGISTRY, fromBlock: 238168n });
  const phases: { phase: string; status: string; milliseconds: number; error?: string }[] = [];
  const transactions: {
    phase: string;
    hash: Hex;
    blockNumber: string | null;
    status: string;
    uiPages: string[];
  }[] = [];
  const walletFailures: { method: string; message: string }[] = [];
  const vendorRequests: string[] = [];
  const readiness: { url: string; status: number; at: string }[] = [];
  const evidence = {
    startedAt,
    finishedAt: null as string | null,
    status: 'running',
    chainId: testnet.id,
    chainIdHex: '0x190f1ca9',
    registry: REGISTRY,
    owner: owner.address,
    deployer: deployer.address,
    fundingTPOT: '25',
    deployerBalanceBeforeTPOT: null as string | null,
    deployerBalanceAfterTPOT: null as string | null,
    ownerBalanceAfterTPOT: null as string | null,
    wsId: null as string | null,
    takeover: null as {
      state: string;
      hash: Hex;
      blockNumber: string;
      finalizedHeight: string;
    } | null,
    verification: [] as { text: string; status: string | null }[],
    vendorRefusal: null as string | null,
    staleBundle: null as string | null,
    failedSetupSteps: [] as string[],
    refund: 'not attempted',
    error: null as string | null,
    phases,
    transactions,
    walletFailures,
    vendorRequests,
    readiness,
  };
  let currentPhase = 'preflight';
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const independent = await browser.newContext();
  let ownerPage: Page | undefined;
  const flush = () => writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  function submitted(hash: Hex) {
    if (!transactions.some((tx) => tx.hash === hash))
      transactions.push({
        phase: currentPhase,
        hash,
        blockNumber: null,
        status: 'submitted',
        uiPages: [],
      });
  }
  async function observeReceipt(hash: Hex) {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    submitted(hash);
    const item = transactions.find((tx) => tx.hash === hash);
    if (!item) throw new Error('The observed transaction was not recorded.');
    item.blockNumber = String(receipt.blockNumber);
    item.status = receipt.status;
    return receipt;
  }
  async function observeUI(page: Page) {
    const refs = await page
      .locator('code[title]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
    for (const hash of refs) {
      if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) continue;
      const receipt = await observeReceipt(hash as Hex);
      const item = transactions.find((tx) => tx.hash === hash);
      if (item && !item.uiPages.includes(new URL(page.url()).origin))
        item.uiPages.push(new URL(page.url()).origin);
      await expect(
        page
          .getByRole('link', { name: new RegExp(`^block ${receipt.blockNumber}(?:$| )`) })
          .first(),
      ).toBeVisible();
    }
  }
  async function phase<T>(name: string, work: () => Promise<T>): Promise<T> {
    currentPhase = name;
    const start = Date.now();
    try {
      const result = await test.step(name, work);
      phases.push({ phase: name, status: 'pass', milliseconds: Date.now() - start });
      return result;
    } catch (error) {
      phases.push({
        phase: name,
        status: 'fail',
        milliseconds: Date.now() - start,
        error: shortError(error),
      });
      throw error;
    } finally {
      await flush();
    }
  }
  async function returnBalance() {
    const balance = await client.getBalance({ address: owner.address });
    if (balance === 0n) {
      evidence.refund = 'owner has no remaining balance';
      return;
    }
    const gasPrice = await client.getGasPrice();
    const gas = await client.estimateGas({ account: owner, to: deployer.address, value: 1n });
    const value = balance - gas * gasPrice;
    if (value <= 0n) throw new Error('Remaining owner balance does not cover the refund fee.');
    const hash = await wallet.sendTransaction({
      to: deployer.address,
      value,
      gas,
      gasPrice,
      type: 'legacy',
    });
    submitted(hash);
    if ((await observeReceipt(hash)).status !== 'success')
      throw new Error('Refund transaction reverted.');
    evidence.refund = 'returned remaining balance less the transaction fee';
  }
  try {
    await installOwnerWallet(ownerContext, owner, submitted, (method, message) =>
      walletFailures.push({ method, message }),
    );
    await installOwnerWallet(independent, owner, submitted, (method, message) =>
      walletFailures.push({ method, message }),
    );
    await phase('Hosted apps and testnet preflight', async () => {
      expect(await client.getChainId()).toBe(420420777);
      expect(`0x${testnet.id.toString(16)}`).toBe('0x190f1ca9');
      evidence.deployerBalanceBeforeTPOT = formatEther(
        await client.getBalance({ address: deployer.address }),
      );
      for (const url of [VENDOR_URL, RESTORE_URL]) {
        const deadline = Date.now() + 10 * 60_000;
        while (true) {
          const response = await request.get(url);
          readiness.push({ url, status: response.status(), at: new Date().toISOString() });
          if (response.ok()) break;
          if (response.status() !== 404 || Date.now() >= deadline)
            throw new Error(
              `${url} returned HTTP ${response.status()}; hosted app is unavailable.`,
            );
          await delay(30_000);
        }
      }
      const health = await request.get(`${API_URL}/health`);
      expect(health.ok()).toBe(true);
      const payload = z.object({ writer: z.string() }).parse(await health.json());
      expect(payload.writer.toLowerCase()).toBe(VENDOR_WRITER.toLowerCase());
    });
    await phase('Fund ephemeral owner with 25 tPOT', async () => {
      const hash = await funder.sendTransaction({ to: owner.address, value: parseEther('25') });
      submitted(hash);
      expect((await observeReceipt(hash)).status).toBe('success');
      expect(await client.getBalance({ address: owner.address })).toBe(parseEther('25'));
    });
    const { invite, keyString } = await phase(
      'Owner creates workspace and grants vendor',
      async () => {
        ownerPage = await ownerContext.newPage();
        await ownerPage.goto(VENDOR_URL);
        expect(new URL(ownerPage.url()).searchParams.has('e2e')).toBe(false);
        await ownerPage.getByRole('link', { name: 'Create a workspace', exact: true }).click();
        await ownerPage.getByLabel('Workspace name').fill('Exit drill');
        await ownerPage.getByLabel('Your display name').fill('Owner');
        await ownerPage.getByRole('button', { name: 'Continue to setup' }).click();
        await ownerPage
          .getByRole('button', { name: 'Connect PACKOUT Testnet Owner', exact: true })
          .click();
        await ownerPage.getByRole('button', { name: 'Start setup', exact: true }).click();
        const inviteInput = ownerPage.getByRole('textbox', { name: 'Member invite link' });
        // Await either completion or the UI's real failure, rather than burying a failure in a timeout.
        await expect
          .poll(
            async () => {
              if (await inviteInput.isVisible()) return 'ready';
              const failed = ownerPage?.locator('[data-step-status="failed"]');
              if (failed && (await failed.count())) {
                evidence.failedSetupSteps = await failed.allTextContents();
                throw new Error(`Vendor A setup failed: ${evidence.failedSetupSteps.join('; ')}`);
              }
              return 'waiting';
            },
            { timeout: 240_000 },
          )
          .toBe('ready');
        const setupSteps = ownerPage
          .getByRole('list', { name: 'Setup steps' })
          .getByRole('listitem');
        await expect(setupSteps).toHaveCount(6);
        for (const step of await setupSteps.all())
          await expect(step).toHaveAttribute('data-step-status', 'done');
        const invite = new URL(await inviteInput.inputValue());
        const keyString = new URLSearchParams(invite.hash.slice(1)).get('k');
        expect(keyString).not.toBeNull();
        expect(Buffer.from(keyString ?? '', 'base64url')).toHaveLength(32);
        evidence.wsId = new URLSearchParams(invite.hash.slice(1)).get('ws');
        expect(evidence.wsId).toMatch(/^0x[0-9a-fA-F]{64}$/);
        await observeUI(ownerPage);
        expect(await reader.canWrite(evidence.wsId as Hex, VENDOR_WRITER)).toBe(true);
        return { invite, keyString: keyString ?? '' };
      },
    );
    await phase('Wallet-less member anchors three operations', async () => {
      const memberPage = await memberContext.newPage();
      // Reuse all local-demo assertions; only extend waits for real batching and testnet blocks.
      await writeThreeMemberOps(memberPage, invite, 180_000);
      const appends = await reader.getAppendedRange(evidence.wsId as Hex, 0n, 2n);
      expect(appends).toHaveLength(3);
      for (const event of appends) {
        expect(event.author.toLowerCase()).toBe(VENDOR_WRITER.toLowerCase());
        expect((await observeReceipt(event.txHash)).status).toBe('success');
      }
    });
    const { bundle, bundlePath } = await phase('Owner exports complete bundle', async () => {
      if (!ownerPage) throw new Error('Owner page is unavailable.');
      await ownerPage.getByRole('link', { name: 'Open the journal', exact: true }).click();
      // The shared exportBundle helper pins local chain 31337, so retain its assertions with the real chain id here.
      const downloaded = ownerPage.waitForEvent('download');
      await ownerPage.getByRole('button', { name: 'Export bundle', exact: true }).click();
      const download = await downloaded;
      expect(await download.failure()).toBeNull();
      const bundlePath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(bundlePath);
      const bundle = parseBundle(JSON.parse(await readFile(bundlePath, 'utf8')));
      expect(bundle.chainId).toBe(420420777);
      expect(bundle.registry.toLowerCase()).toBe(REGISTRY.toLowerCase());
      expect(bundle.wsId).toBe(evidence.wsId);
      expect(bundle.envelopes).toHaveLength(3);
      expect(bundle.checkpoint.count).toBe(3);
      return { bundle, bundlePath };
    });
    const page = await independent.newPage();
    page.on('request', (req) => {
      if (new URL(req.url()).origin === API_URL) vendorRequests.push(req.url().split('#')[0]);
    });
    await page.route(`${API_URL}/**`, (route) => route.abort('blockedbyclient'));
    await phase('Independent Restore passes all six real-chain checks', async () => {
      await page.goto(RESTORE_URL);
      expect(new URL(page.url()).searchParams.has('e2e')).toBe(false);
      await page.getByLabel('Drop bundle.json here, or choose it').setInputFiles(bundlePath);
      await page.getByLabel('2. Workspace key or invite link').fill(keyString);
      await page
        .getByRole('button', { name: 'Check this bundle against Portaldot', exact: true })
        .click();
      await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeFocused();
      const checks = page.getByRole('list', { name: 'Verification steps' }).getByRole('listitem');
      await expect(checks).toHaveCount(6);
      for (const step of await checks.all()) {
        await expect(step).toHaveAttribute('data-step-status', 'pass');
        evidence.verification.push({
          text: (await step.textContent()) ?? '',
          status: await step.getAttribute('data-step-status'),
        });
      }
      const restored = page.getByRole('article', { name: 'Keep the history', exact: true });
      await expect(restored).toBeVisible();
      await expect(restored.getByText('Done', { exact: true })).toBeVisible();
      await expect(
        restored.getByText('A real encrypted member operation.', { exact: true }),
      ).toBeVisible();
      await expect(
        restored.getByText('The member does not need a wallet.', { exact: true }),
      ).toBeVisible();
      for (const index of [0, 1, 2])
        await expect(
          restored.getByText(`Anchored on Portaldot · #${index}`, { exact: true }),
        ).toBeVisible();
      expect(vendorRequests).toEqual([]);
    });
    await phase('Owner takes over with honest finality state', async () => {
      await page.getByRole('button', { name: 'Continue to take over', exact: true }).click();
      await page
        .getByRole('button', { name: 'Connect PACKOUT Testnet Owner', exact: true })
        .click();
      await page.getByRole('button', { name: 'Take over this workspace', exact: true }).click();
      const status = page.locator('[data-tx-state="finalized"], [data-tx-state="unfinalized"]');
      await expect(status).toBeVisible({ timeout: 240_000 });
      await expect(page.getByRole('heading', { name: 'Taken over', exact: true })).toBeVisible();
      await expect(
        page.getByText('The workspace is now at epoch 1', { exact: true }),
      ).toBeVisible();
      const state = await status.getAttribute('data-tx-state');
      const hash = (await status.locator('code[title]').getAttribute('title')) as Hex;
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      const receipt = await observeReceipt(hash);
      expect(receipt.status).toBe('success');
      const finalized = await client.getBlock({ blockTag: 'finalized' });
      evidence.takeover = {
        state: state ?? '',
        hash,
        blockNumber: String(receipt.blockNumber),
        finalizedHeight: String(finalized.number),
      };
      if (state === 'finalized') {
        await expect(status.getByText('Finalized.', { exact: true })).toBeVisible();
        expect(finalized.number).toBeGreaterThanOrEqual(receipt.blockNumber);
      } else {
        await expect(
          status.getByText(
            `Included in block ${receipt.blockNumber}. Finality has not been confirmed.`,
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          status.getByText(/Check this transaction before sending again\./),
        ).toBeVisible();
      }
      await observeUI(page);
      expect(await reader.getWorkspace(bundle.wsId)).toMatchObject({ epoch: 1, count: 3n });
    });
    await phase('Owner continues at operation three', async () => {
      await page.getByRole('button', { name: 'Continue writing', exact: true }).click();
      await page.getByLabel('Your display name', { exact: true }).fill('Owner');
      await page.getByLabel('Title', { exact: true }).fill('Continue without the vendor');
      await page
        .getByLabel('Description (optional)', { exact: true })
        .fill('Same workspace, owner-controlled authority.');
      await page.getByRole('button', { name: 'Anchor issue on Portaldot', exact: true }).click();
      const continued = page.getByRole('article', {
        name: 'Continue without the vendor',
        exact: true,
      });
      await expect(continued.getByText('Anchored on Portaldot · #3', { exact: true })).toBeVisible({
        timeout: 240_000,
      });
      const workspace = await reader.getWorkspace(bundle.wsId);
      expect(workspace).toMatchObject({ epoch: 1, count: 4n });
      const appended = await reader.getAppended(bundle.wsId, 3n);
      expect(appended).toMatchObject({
        wsId: bundle.wsId,
        index: 3n,
        epoch: 1,
        author: owner.address,
        head: workspace?.head,
      });
      if (!appended) throw new Error('The owner continuation is missing on-chain.');
      expect((await observeReceipt(appended.txHash)).status).toBe('success');
      await observeUI(page);
    });
    await phase('Portaldot refuses the real vendor comeback with NotWriter', async () => {
      const before = await reader.getWorkspace(bundle.wsId);
      const previousAppend = await reader.getAppended(bundle.wsId, 2n);
      if (!before || !previousAppend) throw new Error('The completed history is missing on-chain.');
      let refusal: unknown;
      try {
        await client.simulateContract({
          abi: packoutRegistryAbi,
          address: bundle.registry,
          functionName: 'appendBatch',
          args: [bundle.wsId, before.count, before.head, [previousAppend.digest]],
          account: VENDOR_WRITER,
        });
      } catch (error) {
        refusal = error;
      }
      evidence.vendorRefusal = decodedRevert(refusal);
      expect(evidence.vendorRefusal).toMatch(/^NotWriter\(/);
      expect(await reader.getWorkspace(bundle.wsId)).toEqual(before);
      // A real eth_call from the deployed writer proves rejection without touching its private key.
    });
    await phase('Stale pre-takeover bundle is blocked at Complete history', async () => {
      await page
        .getByRole('navigation', { name: 'Workspace steps' })
        .getByRole('button', { name: /^Import/ })
        .click();
      await page.getByLabel('Drop bundle.json here, or choose it').setInputFiles(bundlePath);
      await page.getByLabel('2. Workspace key or invite link').fill(keyString);
      await page
        .getByRole('button', { name: 'Check this bundle against Portaldot', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Verification failed', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Verification failed', exact: true }),
      ).toBeFocused();
      const complete = page
        .getByRole('list', { name: 'Verification steps' })
        .getByRole('listitem')
        .filter({ has: page.getByText('Complete history: Failed', { exact: true }) });
      await expect(complete).toHaveAttribute('data-step-status', 'fail');
      const reason = 'This bundle is stale: 1 operation is missing from this file.';
      await expect(complete.getByText(reason, { exact: true })).toBeVisible();
      evidence.staleBundle = reason;
      const navigation = page.getByRole('navigation', { name: 'Workspace steps' });
      await expect(navigation.getByRole('button', { name: /^Take over/ })).toBeDisabled();
      await expect(navigation.getByRole('button', { name: /^Continue/ })).toBeDisabled();
      expect(vendorRequests).toEqual([]);
    });
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed';
    evidence.error = shortError(error);
    if (ownerPage) {
      evidence.failedSetupSteps = await ownerPage
        .locator('[data-step-status="failed"]')
        .allTextContents()
        .catch(() => []);
    }
    throw error;
  } finally {
    // Cleanup is deliberately independent of Playwright's assertion clock and never hides the original result.
    currentPhase = 'Return remaining owner balance';
    const refundStart = Date.now();
    try {
      for (const tx of transactions.filter((tx) => tx.blockNumber === null))
        await observeReceipt(tx.hash);
      await returnBalance();
      phases.push({ phase: currentPhase, status: 'pass', milliseconds: Date.now() - refundStart });
    } catch (error) {
      evidence.refund = shortError(error);
      phases.push({
        phase: currentPhase,
        status: 'warning',
        milliseconds: Date.now() - refundStart,
        error: evidence.refund,
      });
      console.warn(`Best-effort refund: ${evidence.refund}`);
    }
    try {
      evidence.deployerBalanceAfterTPOT = formatEther(
        await client.getBalance({ address: deployer.address }),
      );
      evidence.ownerBalanceAfterTPOT = formatEther(
        await client.getBalance({ address: owner.address }),
      );
    } catch (error) {
      console.warn(`Final balance read: ${shortError(error)}`);
    }
    evidence.finishedAt = new Date().toISOString();
    await flush();
    console.table(
      phases.map(({ phase, status, milliseconds }) => ({
        phase,
        status,
        seconds: (milliseconds / 1000).toFixed(1),
      })),
    );
    console.log(`Evidence: ${evidencePath}`);
    console.log(
      `Deployer tPOT: ${evidence.deployerBalanceBeforeTPOT} -> ${evidence.deployerBalanceAfterTPOT}`,
    );
    await Promise.all([ownerContext.close(), memberContext.close(), independent.close()]);
  }
});
