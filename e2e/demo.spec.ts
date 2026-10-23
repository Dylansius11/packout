import { packoutRegistryAbi } from '@packout/sdk';
import { expect } from '@playwright/test';
import { decodedRevert, forceRejectedAppend } from '../scripts/lib/force-rejected.ts';
import { localDemoSession, test } from './fixtures.ts';
import {
  CLIENT_B_URL,
  exportBundle,
  onboardOwner,
  VENDOR_API_URL,
  writeThreeMemberOps,
} from './helpers.ts';

test('the workspace continues after vendor shutdown and Portaldot rejects the vendor comeback', async ({
  browser,
  request,
  vendorProcess,
}, testInfo) => {
  const owner = await browser.newContext();
  const member = await browser.newContext();
  const independent = await browser.newContext();
  const vendorRequests: string[] = [];
  independent.on('request', (req) => {
    if (new URL(req.url()).origin === VENDOR_API_URL) vendorRequests.push(req.url());
  });
  try {
    const ownerPage = await owner.newPage();
    const { invite, keyString } = await onboardOwner(ownerPage, testInfo);
    const vendorPage = await member.newPage();
    await writeThreeMemberOps(vendorPage, invite);
    await ownerPage.getByRole('link', { name: 'Open the journal', exact: true }).click();
    const { bundle, bundlePath } = await exportBundle(ownerPage, testInfo);
    const session = await localDemoSession(request);
    expect(session.deployment.address.toLowerCase()).toBe(bundle.registry.toLowerCase());
    const previousAppend = await session.reader.getAppended(bundle.wsId, 2n);
    expect(previousAppend).not.toBeNull();
    if (!previousAppend) throw new Error('The vendor did not anchor the third member operation.');
    const previousReceipt = await session.client.getTransactionReceipt({
      hash: previousAppend.txHash,
    });
    expect(previousReceipt.status).toBe('success');
    const failedRequest = vendorPage.waitForEvent('requestfailed', {
      predicate: (req) => new URL(req.url()).origin === VENDOR_API_URL,
    });
    await vendorProcess.stop();
    await expect(request.get(`${VENDOR_API_URL}/health`, { timeout: 1000 })).rejects.toThrow();
    await failedRequest;
    await expect(
      vendorPage.getByText('Vendor A is offline. Your changes stay on this device.', {
        exact: true,
      }),
    ).toBeVisible();

    const page = await independent.newPage();
    await page.goto(`${CLIENT_B_URL}/?e2e=1`);
    await page.getByLabel('Drop bundle.json here, or choose it').setInputFiles(bundlePath);
    await page.getByLabel('2. Workspace key or invite link').fill(keyString);
    await page
      .getByRole('button', { name: 'Check this bundle against Portaldot', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible();
    const checks = page.getByRole('list', { name: 'Verification steps' }).getByRole('listitem');
    await expect(checks).toHaveCount(6);
    for (const step of await checks.all())
      await expect(step).toHaveAttribute('data-step-status', 'pass');
    const restored = page.getByRole('article', { name: 'Keep the history', exact: true });
    await expect(restored).toBeVisible();
    await expect(restored.getByText('Done', { exact: true })).toBeVisible();
    await expect(
      restored.getByText('A real encrypted member operation.', { exact: true }),
    ).toBeVisible();
    await expect(
      restored.getByText('The member does not need a wallet.', { exact: true }),
    ).toBeVisible();
    for (const index of [0, 1, 2]) {
      await expect(
        restored.getByText(`Anchored on Portaldot · #${index}`, { exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: testInfo.outputPath('client-b-restored-offline.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Continue to take over', exact: true }).click();
    await page.getByRole('button', { name: 'Connect local test account', exact: true }).click();
    await page.getByRole('button', { name: 'Take over this workspace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Taken over', exact: true })).toBeVisible();
    await expect(page.getByText('The workspace is now at epoch 1', { exact: true })).toBeVisible();
    expect(await session.reader.getWorkspace(bundle.wsId)).toMatchObject({ epoch: 1, count: 3n });
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
    await expect(continued.getByText('Anchored on Portaldot · #3', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('client-b-new-write.png'), fullPage: true });
    const beforeRejected = await session.reader.getWorkspace(bundle.wsId);
    expect(beforeRejected).toMatchObject({ epoch: 1, count: 4n });
    if (!beforeRejected) throw new Error('The continued workspace is missing on-chain.');
    expect(await session.reader.getAppended(bundle.wsId, 3n)).toMatchObject({
      wsId: bundle.wsId,
      index: 3n,
      epoch: 1,
      author: beforeRejected.owner,
      head: beforeRejected.head,
    });
    await expect(request.get(`${VENDOR_API_URL}/health`, { timeout: 1000 })).rejects.toThrow();
    await vendorProcess.start();
    const health = await request.get(`${VENDOR_API_URL}/health`);
    expect(health.ok()).toBe(true);
    expect((await health.json()).writer.toLowerCase()).toBe(session.vendorAddress.toLowerCase());
    const digests = [previousAppend.digest];
    let refusal: unknown;
    try {
      await session.client.simulateContract({
        abi: packoutRegistryAbi,
        address: bundle.registry,
        functionName: 'appendBatch',
        args: [bundle.wsId, beforeRejected.count, beforeRejected.head, digests],
        account: session.vendorAddress,
      });
    } catch (error) {
      refusal = error;
    }
    expect(decodedRevert(refusal)).toMatch(/^NotWriter\(/);
    let submittedHash: string | undefined;
    const rejected = await forceRejectedAppend(session, {
      wsId: bundle.wsId,
      expectedCount: beforeRejected.count,
      expectedHead: beforeRejected.head,
      digests,
      successfulAppendGasUsed: previousReceipt.gasUsed,
      onSubmitted: (hash) => {
        submittedHash = hash;
      },
    });
    expect(submittedHash).toBe(rejected.hash);
    expect(rejected.status).toBe('reverted');
    expect(rejected.revertReason).toMatch(/^NotWriter\(/);
    const rejectedReceipt = await session.client.getTransactionReceipt({ hash: rejected.hash });
    expect(rejectedReceipt.status).toBe('reverted');
    expect(rejectedReceipt.from.toLowerCase()).toBe(session.vendorAddress.toLowerCase());
    expect(rejectedReceipt.to?.toLowerCase()).toBe(bundle.registry.toLowerCase());
    expect(await session.reader.getWorkspace(bundle.wsId)).toEqual(beforeRejected);
    await testInfo.attach('vendor-rejection', {
      body: JSON.stringify({
        hash: rejected.hash,
        status: rejected.status,
        reason: rejected.revertReason,
        blockNumber: String(rejected.blockNumber),
      }),
      contentType: 'application/json',
    });

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
    const complete = page
      .getByRole('list', { name: 'Verification steps' })
      .getByRole('listitem')
      .filter({
        has: page.getByText('Complete history: Failed', { exact: true }),
      });
    await expect(complete).toHaveAttribute('data-step-status', 'fail');
    await expect(
      complete.getByText('This bundle is stale: 1 operation is missing from this file.', {
        exact: true,
      }),
    ).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Workspace steps' });
    await expect(navigation.getByRole('button', { name: /^Take over/ })).toBeDisabled();
    await expect(navigation.getByRole('button', { name: /^Continue/ })).toBeDisabled();
    expect(vendorRequests).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('client-b-stale-bundle-blocked.png'),
      fullPage: true,
    });
  } finally {
    await Promise.all([owner.close(), member.close(), independent.close()]);
  }
});
