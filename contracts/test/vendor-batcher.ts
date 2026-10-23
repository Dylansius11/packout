import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  chainHeads,
  createRegistryReader,
  createRegistryWriter,
  describeRegistryError,
  RegistryError,
  type RegistryWriter,
  ZERO_HEAD,
} from '@packout/sdk';
import { network } from 'hardhat';
import { type Hex, keccak256, stringToHex } from 'viem';
import { createBatcher } from '../../apps/vendor-api/src/batcher.ts';
import { createReceiptLookup } from '../../apps/vendor-api/src/receipts.ts';
import { EnvelopeStore } from '../../apps/vendor-api/src/store.ts';
import { salt, schemaId } from './helpers.ts';

async function fixture(context: TestContext, count = 3) {
  const directory = mkdtempSync(join(tmpdir(), 'packout-chain-batcher-'));
  const store = new EnvelopeStore(join(directory, 'store.sqlite'));
  const connection = await network.create('default');
  const client = await connection.viem.getPublicClient();
  const [owner, vendor] = await connection.viem.getWalletClients();
  const contract = await connection.viem.deployContract('PackoutRegistry');
  const ownerWriter = createRegistryWriter({ client, wallet: owner, registry: contract.address });
  const writer = createRegistryWriter({ client, wallet: vendor, registry: contract.address });
  const reader = createRegistryReader({ client, registry: contract.address });
  const receipts = createReceiptLookup({ client, registry: contract.address });
  const { wsId } = await ownerWriter.createWorkspace(salt, schemaId);
  await ownerWriter.grantWriter(wsId, vendor.account.address);
  store.registerWorkspace(wsId, vendor.account.address, 0n);
  for (let i = 0; i < count; i++)
    store.submitEnvelope(wsId, `0x01${i.toString(16).padStart(2, '0').repeat(40)}` as Hex);
  context.after(async () => {
    store.close();
    await connection.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    store,
    connection,
    client,
    owner,
    vendor,
    contract,
    ownerWriter,
    writer,
    reader,
    receipts,
    wsId,
  };
}

it('vendor batcher anchors three ciphertext envelopes with exact receipt indexes and chain head', async (context) => {
  const f = await fixture(context);
  const pending = f.store.pendingEnvelopes(f.wsId);
  const batcher = createBatcher({
    store: f.store,
    reader: f.reader,
    writer: f.writer,
    receipts: f.receipts,
    wsId: f.wsId,
    intervalMs: 10,
  });
  context.after(() => batcher.stop());
  await batcher.tick();
  const items = f.store.listEnvelopes(f.wsId, 0, 200);
  assert.deepEqual(
    items.map((item) => item.status),
    ['anchored', 'anchored', 'anchored'],
  );
  assert.deepEqual(
    items.map((item) => item.index),
    [0, 1, 2],
  );
  const state = await f.reader.getWorkspace(f.wsId);
  assert.ok(state);
  assert.equal(state.count, 3n);
  assert.equal(
    state.head,
    chainHeads(
      f.wsId,
      0n,
      ZERO_HEAD,
      pending.map((item) => item.digest),
    )[2],
  );
  const events = await f.reader.getAppendedRange(f.wsId, 0n, 2n);
  for (const item of items) {
    const event = events.find((entry) => entry.digest === item.digest);
    assert.ok(event);
    assert.equal(item.index, Number(event.index));
    assert.equal(item.txHash, event.txHash);
    assert.equal(item.blockNumber, Number(event.blockNumber));
  }
  assert.deepEqual(f.store.getWorkspace(f.wsId), {
    wsId: f.wsId,
    writer: f.vendor.account.address,
    writerState: 'active',
    pending: 0,
    anchoredCount: 3,
    chainCount: 3,
    lastError: null,
  });
  const duplicate = f.store.submitEnvelope(f.wsId, items[0].envelope);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.item.status, 'anchored');
});

it('vendor batcher rereads and retries on top of an owner append racing its checkpoint', async (context) => {
  const f = await fixture(context);
  const digests = f.store.pendingEnvelopes(f.wsId).map((item) => item.digest);
  const ownerDigest = keccak256(stringToHex('independent owner write'));
  let raced = false;
  const reader = {
    async getWorkspace(wsId: Hex) {
      const state = await f.reader.getWorkspace(wsId);
      assert.ok(state);
      if (!raced) {
        raced = true;
        await f.ownerWriter.appendBatch(wsId, state.count, state.head, [ownerDigest]);
      }
      return state;
    },
  };
  let attempts = 0;
  const writer: Pick<RegistryWriter, 'appendBatch'> = {
    async appendBatch(...args) {
      attempts++;
      return f.writer.appendBatch(...args);
    },
  };
  const batcher = createBatcher({
    store: f.store,
    reader,
    writer,
    receipts: f.receipts,
    wsId: f.wsId,
    intervalMs: 10,
  });
  context.after(() => batcher.stop());
  await batcher.tick();
  assert.equal(attempts, 2);
  assert.deepEqual(
    f.store.listEnvelopes(f.wsId, 0, 200).map((item) => item.index),
    [1, 2, 3],
  );
  const state = await f.reader.getWorkspace(f.wsId);
  assert.ok(state);
  assert.equal(state.count, 4n);
  assert.equal(state.head, chainHeads(f.wsId, 0n, ZERO_HEAD, [ownerDigest, ...digests])[3]);
  assert.equal(f.store.getWorkspace(f.wsId)?.lastError, null);
});

it('vendor batcher stops after real epoch revocation and never retries rejected envelopes', async (context) => {
  const f = await fixture(context);
  await f.ownerWriter.rotateEpoch(f.wsId, []);
  let attempts = 0;
  const writer: Pick<RegistryWriter, 'appendBatch'> = {
    async appendBatch(...args) {
      attempts++;
      return f.writer.appendBatch(...args);
    },
  };
  const batcher = createBatcher({
    store: f.store,
    reader: f.reader,
    writer,
    receipts: f.receipts,
    wsId: f.wsId,
    intervalMs: 10,
  });
  context.after(() => batcher.stop());
  batcher.start();
  await batcher.tick();
  const message = describeRegistryError(
    new RegistryError('NotWriter', [f.wsId, f.vendor.account.address, 1]),
  );
  assert.equal(f.store.getWorkspace(f.wsId)?.writerState, 'revoked');
  assert.equal(f.store.getWorkspace(f.wsId)?.lastError, message);
  assert.deepEqual(
    f.store.listEnvelopes(f.wsId, 0, 200).map((item) => item.status),
    ['rejected', 'rejected', 'rejected'],
  );
  await delay(50);
  await batcher.tick();
  assert.equal(attempts, 1);
  assert.equal((await f.reader.getWorkspace(f.wsId))?.count, 0n);
});

it('vendor batcher respects the 64-envelope contract limit and drains the remainder next tick', async (context) => {
  const f = await fixture(context, 65);
  const batcher = createBatcher({
    store: f.store,
    reader: f.reader,
    writer: f.writer,
    receipts: f.receipts,
    wsId: f.wsId,
    intervalMs: 10,
  });
  context.after(() => batcher.stop());
  await batcher.tick();
  assert.equal(f.store.getWorkspace(f.wsId)?.anchoredCount, 64);
  assert.equal(f.store.getWorkspace(f.wsId)?.pending, 1);
  await batcher.tick();
  assert.equal(f.store.getWorkspace(f.wsId)?.anchoredCount, 65);
  assert.equal(f.store.getWorkspace(f.wsId)?.pending, 0);
  assert.deepEqual(
    f.store.listEnvelopes(f.wsId, 0, 200).map((item) => item.index),
    Array.from({ length: 65 }, (_, index) => index),
  );
  assert.equal((await f.reader.getWorkspace(f.wsId))?.count, 65n);
});

it('vendor batcher reconciles a real successful submission after the writer loses its response', async (context) => {
  const f = await fixture(context);
  assert.equal(await f.receipts.lookup(ZERO_HEAD), null);
  let attempts = 0;
  const writer: Pick<RegistryWriter, 'appendBatch'> = {
    async appendBatch(...args) {
      attempts++;
      await f.writer.appendBatch(...args);
      throw new Error('Connection lost after successful submission.');
    },
  };
  const batcher = createBatcher({
    store: f.store,
    reader: f.reader,
    writer,
    receipts: f.receipts,
    wsId: f.wsId,
    intervalMs: 10,
  });
  context.after(() => batcher.stop());
  await batcher.tick();
  assert.equal(f.store.getWorkspace(f.wsId)?.pending, 3);
  assert.ok(f.store.pendingEnvelopes(f.wsId).every((item) => item.txHash !== null));
  await batcher.tick();
  assert.equal(attempts, 1);
  assert.equal(f.store.getWorkspace(f.wsId)?.pending, 0);
  assert.equal(f.store.getWorkspace(f.wsId)?.anchoredCount, 3);
  assert.equal((await f.reader.getWorkspace(f.wsId))?.count, 3n);
  assert.equal((await f.reader.getAppendedRange(f.wsId, 0n, 99n)).length, 3);
});
