import { readFile } from 'node:fs/promises';
import { createRegistryReader, parseBundle, verifyBundle } from '@packout/sdk';
import { expect, test } from '@playwright/test';
import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';

const RPC_URL = 'http://127.0.0.1:8645';

test('owner onboards, a wallet-less member writes three operations, and the exported bundle verifies', async ({
  browser,
}, testInfo) => {
  const owner = await browser.newContext();
  const member = await browser.newContext();
  try {
    const ownerPage = await owner.newPage();
    await ownerPage.goto('/?e2e=1');
    await ownerPage.getByRole('link', { name: 'Create a workspace', exact: true }).click();
    await ownerPage.getByLabel('Workspace name').fill('Exit drill');
    await ownerPage.getByLabel('Your display name').fill('Owner');
    await ownerPage.getByRole('button', { name: 'Continue to setup' }).click();
    await ownerPage.getByRole('button', { name: 'Connect local test account' }).click();
    await ownerPage.getByRole('button', { name: 'Start setup', exact: true }).click();
    const inviteInput = ownerPage.getByRole('textbox', { name: 'Member invite link' });
    await expect(inviteInput).toBeVisible();
    const setupSteps = ownerPage.getByRole('list', { name: 'Setup steps' }).getByRole('listitem');
    await expect(setupSteps).not.toHaveCount(0);
    for (const step of await setupSteps.all()) {
      await expect(step).toHaveAttribute('data-step-status', 'done');
    }
    const invite = new URL(await inviteInput.inputValue());
    const keyString = new URLSearchParams(invite.hash.slice(1)).get('k');
    expect(keyString).not.toBeNull();
    const key = new Uint8Array(Buffer.from(keyString ?? '', 'base64url'));
    expect(key).toHaveLength(32);
    await ownerPage.screenshot({
      path: testInfo.outputPath('owner-onboarded.png'),
      fullPage: true,
    });

    const page = await member.newPage();
    await page.goto(invite.href);
    await page.getByLabel('Your display name').fill('Dina');
    await page.getByRole('button', { name: 'Join workspace', exact: true }).click();
    await expect(page.getByText('You are a member', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => 'ethereum' in window)).toBe(false);
    await expect(page.getByRole('button', { name: /Connect/ })).toHaveCount(0);
    await page.getByLabel('Title', { exact: true }).fill('Keep the history');
    await page
      .getByLabel('Description', { exact: true })
      .fill('A real encrypted member operation.');
    await page.getByRole('button', { name: 'Create issue', exact: true }).click();
    const issue = page.getByRole('list', { name: 'Issues', exact: true }).getByRole('listitem');
    await expect(issue.getByText('Anchored on Portaldot · #0', { exact: true })).toBeVisible();
    await issue.getByRole('link').click();
    await expect(
      page.getByRole('heading', { name: 'Keep the history', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Comment', { exact: true }).fill('The member does not need a wallet.');
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    const comment = page.getByRole('list', { name: 'Comments', exact: true }).getByRole('listitem');
    await expect(comment.getByText('Anchored on Portaldot · #1', { exact: true })).toBeVisible();
    const issueHeader = page.getByRole('article').locator('header');
    await page.getByLabel('Status', { exact: true }).selectOption('done');
    await expect(page.getByLabel('Status', { exact: true })).toHaveValue('done');
    await expect(
      issueHeader.getByText('Anchored on Portaldot · #2', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'All issues', exact: true }).click();

    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export bundle', exact: true }).click();
    const download = await downloaded;
    expect(await download.failure()).toBeNull();
    const bundlePath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(bundlePath);
    const bundle = parseBundle(JSON.parse(await readFile(bundlePath, 'utf8')));
    expect(bundle.chainId).toBe(31337);
    expect(bundle.envelopes).toHaveLength(3);
    expect(bundle.checkpoint.count).toBe(3);
    const chain = createRegistryReader({
      client: createPublicClient({ chain: hardhat, transport: http(RPC_URL) }),
      registry: bundle.registry,
      fromBlock: 0n,
    });
    const report = await verifyBundle({ bundle, key, chain });
    expect(report.ok, JSON.stringify(report.steps)).toBe(true);
    expect(report.steps.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'format', status: 'pass' },
      { id: 'envelopes', status: 'pass' },
      { id: 'head', status: 'pass' },
      { id: 'anchored', status: 'pass' },
      { id: 'complete', status: 'pass' },
      { id: 'decrypt', status: 'pass' },
    ]);
    expect(report.ops?.map((op) => op.type)).toEqual([
      'issue.create',
      'comment.add',
      'issue.setStatus',
    ]);
    expect(report.ops?.every((op) => op.author.name === 'Dina')).toBe(true);
    expect(report.state?.issues[0]).toMatchObject({
      title: 'Keep the history',
      status: 'done',
      comments: [{ text: 'The member does not need a wallet.' }],
    });
    const checks = page.getByRole('list', { name: 'Export checks' });
    await expect(checks.getByRole('listitem')).toHaveCount(7);
    for (const step of report.steps) {
      const row = checks.getByRole('listitem').filter({
        has: page.getByText(`${step.title}: Done`, { exact: true }),
      });
      await expect(row).toHaveAttribute('data-step-status', 'done');
      await expect(row.getByText(step.message, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByText('Every check passed. The file contains no key and no plaintext.'),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('member-export-verified.png'),
      fullPage: true,
    });
  } finally {
    await Promise.all([owner.close(), member.close()]);
  }
});
