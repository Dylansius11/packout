import { createRegistryReader, verifyBundle } from '@packout/sdk';
import { expect, test } from '@playwright/test';
import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import {
  expectExportChecks,
  exportBundle,
  onboardOwner,
  RPC_URL,
  writeThreeMemberOps,
} from './helpers.ts';

test('owner onboards, a wallet-less member writes three operations, and the exported bundle verifies', async ({
  browser,
}, testInfo) => {
  const owner = await browser.newContext();
  const member = await browser.newContext();
  try {
    const { invite, key } = await onboardOwner(await owner.newPage(), testInfo);
    const page = await member.newPage();
    await writeThreeMemberOps(page, invite);
    const { bundle } = await exportBundle(page, testInfo);
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
    await expectExportChecks(page, report);
    await page.screenshot({
      path: testInfo.outputPath('member-export-verified.png'),
      fullPage: true,
    });
  } finally {
    await Promise.all([owner.close(), member.close()]);
  }
});
