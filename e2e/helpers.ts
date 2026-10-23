import { readFile } from 'node:fs/promises';
import { parseBundle, type VerificationReport } from '@packout/sdk';
import { expect, type Page, type TestInfo } from '@playwright/test';

export const RPC_URL = 'http://127.0.0.1:8645';
export const VENDOR_API_URL = 'http://127.0.0.1:8887';
export const CLIENT_B_URL = 'http://127.0.0.1:5274';

export async function onboardOwner(page: Page, testInfo: TestInfo) {
  await page.goto('/?e2e=1');
  await page.getByRole('link', { name: 'Create a workspace', exact: true }).click();
  await page.getByLabel('Workspace name').fill('Exit drill');
  await page.getByLabel('Your display name').fill('Owner');
  await page.getByRole('button', { name: 'Continue to setup' }).click();
  await page.getByRole('button', { name: 'Connect local test account' }).click();
  await page.getByRole('button', { name: 'Start setup', exact: true }).click();
  const inviteInput = page.getByRole('textbox', { name: 'Member invite link' });
  await expect(inviteInput).toBeVisible();
  const setupSteps = page.getByRole('list', { name: 'Setup steps' }).getByRole('listitem');
  await expect(setupSteps).not.toHaveCount(0);
  for (const step of await setupSteps.all()) {
    await expect(step).toHaveAttribute('data-step-status', 'done');
  }
  const invite = new URL(await inviteInput.inputValue());
  const keyString = new URLSearchParams(invite.hash.slice(1)).get('k');
  expect(keyString).not.toBeNull();
  const key = new Uint8Array(Buffer.from(keyString ?? '', 'base64url'));
  expect(key).toHaveLength(32);
  await page.screenshot({ path: testInfo.outputPath('owner-onboarded.png'), fullPage: true });
  return { invite, key, keyString: keyString ?? '' };
}

export async function writeThreeMemberOps(page: Page, invite: URL) {
  await page.goto(invite.href);
  await page.getByLabel('Your display name').fill('Dina');
  await page.getByRole('button', { name: 'Join workspace', exact: true }).click();
  await expect(page.getByText('You are a member', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => 'ethereum' in window)).toBe(false);
  await expect(page.getByRole('button', { name: /Connect/ })).toHaveCount(0);
  await page.getByLabel('Title', { exact: true }).fill('Keep the history');
  await page.getByLabel('Description', { exact: true }).fill('A real encrypted member operation.');
  await page.getByRole('button', { name: 'Create issue', exact: true }).click();
  const issue = page.getByRole('list', { name: 'Issues', exact: true }).getByRole('listitem');
  await expect(issue.getByText('Anchored on Portaldot · #0', { exact: true })).toBeVisible();
  await issue.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Keep the history', exact: true })).toBeVisible();
  await page.getByLabel('Comment', { exact: true }).fill('The member does not need a wallet.');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  const comment = page.getByRole('list', { name: 'Comments', exact: true }).getByRole('listitem');
  await expect(comment.getByText('Anchored on Portaldot · #1', { exact: true })).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('done');
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('done');
  await expect(
    page
      .getByRole('article')
      .locator('header')
      .getByText('Anchored on Portaldot · #2', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'All issues', exact: true }).click();
}

export async function exportBundle(page: Page, testInfo: TestInfo) {
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
  return { bundlePath, bundle };
}

export async function expectExportChecks(page: Page, report: VerificationReport) {
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
}
