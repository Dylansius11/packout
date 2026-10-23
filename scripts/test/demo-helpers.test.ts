import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  fundingMessage,
  mappedNativeAddress,
  parseDeployment,
  parseNetwork,
  parseTestnetEnv,
  waitForFinalized,
} from '../lib/demo.ts';

const owner = '0xb8c47dfB101938a0F57011aEf6EF5cC2CE97D859';
const vendor = '0x651dBB5965c6538AbC4027bEFAc3523FF28fF1a0';

test('selects the default testnet or an explicit localhost rehearsal and rejects unknown arguments', () => {
  assert.equal(parseNetwork([]), 'portaldotTestnet');
  assert.equal(parseNetwork(['--network', 'localhost']), 'localhost');
  assert.equal(parseNetwork(['--network', 'portaldotTestnet']), 'portaldotTestnet');
  assert.throws(() => parseNetwork(['--network', 'mainnet']), /network/);
  assert.throws(() => parseNetwork(['--network']), /network/);
  assert.throws(() => parseNetwork(['--extra']), /Usage/);
});

test('validates deployment fields before the script sends any transactions', () => {
  const deployment = { network: 'localhost', chainId: 31337, address: owner, blockNumber: '1' };
  assert.deepEqual(parseDeployment(deployment, 'localhost'), deployment);
  assert.throws(() => parseDeployment({ ...deployment, address: '0x12' }, 'localhost'), /address/);
  assert.throws(
    () => parseDeployment({ ...deployment, blockNumber: '-1' }, 'localhost'),
    /blockNumber/,
  );
  assert.throws(() => parseDeployment({ ...deployment, chainId: 0 }, 'localhost'), /chainId/);
  assert.throws(() => parseDeployment(deployment, 'portaldotTestnet'), /network/);
});

test('reports missing env field names without exposing their values', () => {
  assert.throws(() => parseTestnetEnv({}), /DEPLOYER_PRIVATE_KEY/);
  assert.throws(
    () => parseTestnetEnv({ DEPLOYER_PRIVATE_KEY: 'not-a-key' }),
    (error) => {
      assert(error instanceof Error);
      assert.match(error.message, /DEPLOYER_PRIVATE_KEY/);
      assert.doesNotMatch(error.message, /not-a-key/);
      return true;
    },
  );
});

test('derives mapped funding addresses from the integration guide without needing secrets', () => {
  assert.equal(mappedNativeAddress(owner), '5GEy3B5b8LhcwUf2tD9wMmhmJrLgV272jpvWTxwbEZvJ3NsV');
  assert.equal(mappedNativeAddress(vendor), '5EMHXSkuyeDhMMVft4oZagVoRmJ8KZF2RhxqgdxiCYuEYMu5');
  const message = fundingMessage('owner', owner, 'portaldotTestnet');
  assert.match(message, /owner/);
  assert.match(message, new RegExp(owner));
  assert.match(message, /5GEy3B5b8LhcwUf2tD9wMmhmJrLgV272jpvWTxwbEZvJ3NsV/);
  assert.doesNotMatch(fundingMessage('owner', owner, 'localhost'), /5GEy/);
});

test('does not claim finality while the finalized block remains behind the receipt', async () => {
  let calls = 0;
  const reader = {
    async getBlock(input: { blockTag: 'finalized' }) {
      assert.equal(input.blockTag, 'finalized');
      calls += 1;
      return { number: calls === 1 ? 9n : 10n };
    },
  };
  const finalized = await waitForFinalized(reader, 10n, { timeoutMs: 1000, pollMs: 0 });
  assert.equal(finalized, 10n);
  assert.equal(calls, 2);
});

test('shows a timeout rather than inventing finality', async () => {
  await assert.rejects(
    waitForFinalized({ getBlock: async () => ({ number: 9n }) }, 10n, { timeoutMs: 0, pollMs: 0 }),
    /not finalized.*timeout|timeout.*not finalized/i,
  );
});
