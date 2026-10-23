import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type AppendedEvent,
  describeRegistryError,
  RegistryError,
  type RegistryReader,
  type RegistryWriter,
} from '@packout/sdk';
import { type Hex, zeroAddress, zeroHash } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBatcher } from '../src/batcher.ts';
import { EnvelopeStore } from '../src/store.ts';

const wsId = `0x${'11'.repeat(32)}` as Hex;
const records: { store: EnvelopeStore; directory: string }[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'packout-batcher-'));
  const store = new EnvelopeStore(join(directory, 'store.sqlite'));
  records.push({ store, directory });
  store.registerWorkspace(wsId, zeroAddress, 0n);
  store.submitEnvelope(wsId, `0x01${'aa'.repeat(40)}`);
  const reader: Pick<RegistryReader, 'getWorkspace'> = {
    async getWorkspace() {
      return { owner: zeroAddress, count: 0n, head: zeroHash, epoch: 0, schemaId: zeroHash };
    },
  };
  return {
    store,
    reader,
    receipts: {
      async lookup() {
        return null;
      },
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  for (const { store, directory } of records.splice(0)) {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('batcher retry and lifecycle rules', () => {
  it('limits stale retries to three attempts per tick and keeps envelopes pending', async () => {
    const { store, reader, receipts } = fixture();
    let attempts = 0;
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch() {
        attempts++;
        throw new RegistryError('StaleCount', [0n, 1n]);
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    await batcher.tick();
    expect(attempts).toBe(3);
    expect(store.getWorkspace(wsId)).toMatchObject({
      writerState: 'active',
      pending: 1,
      lastError: describeRegistryError(new RegistryError('StaleCount', [0n, 1n])),
    });
    await batcher.tick();
    expect(attempts).toBe(6);
    await batcher.stop();
  });

  it('waits until the next tick after a transport error', async () => {
    const { store, reader, receipts } = fixture();
    let attempts = 0;
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch() {
        attempts++;
        throw new Error('RPC temporarily unavailable.');
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    await batcher.tick();
    expect(attempts).toBe(1);
    expect(store.getWorkspace(wsId)).toMatchObject({
      pending: 1,
      writerState: 'active',
      lastError: 'RPC temporarily unavailable.',
    });
    await batcher.tick();
    expect(attempts).toBe(2);
    await batcher.stop();
  });

  it('records the submitted hash while pending and never overlaps concurrent ticks', async () => {
    const { store, reader, receipts } = fixture();
    let release!: (events: AppendedEvent[]) => void;
    const waiting = new Promise<AppendedEvent[]>((resolve) => {
      release = resolve;
    });
    let attempts = 0;
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch(_id, _count, _head, digests, options) {
        attempts++;
        options?.onSubmitted?.(zeroHash);
        const appended = await waiting;
        expect(digests).toHaveLength(1);
        return { hash: zeroHash, blockNumber: 1n, gasUsed: 1n, effectiveGasPrice: 1n, appended };
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    const first = batcher.tick();
    const second = batcher.tick();
    await vi.waitFor(() => expect(store.pendingEnvelopes(wsId)[0].txHash).toBe(zeroHash));
    expect(store.pendingEnvelopes(wsId)[0].status).toBe('pending');
    const item = store.pendingEnvelopes(wsId)[0];
    release([
      {
        wsId,
        index: 0n,
        digest: item.digest,
        head: zeroHash,
        epoch: 0,
        author: zeroAddress,
        txHash: zeroHash,
        blockNumber: 1n,
      },
    ]);
    await Promise.all([first, second]);
    expect(attempts).toBe(1);
    expect(store.getWorkspace(wsId)).toMatchObject({
      pending: 0,
      anchoredCount: 1,
      lastError: null,
    });
    await batcher.stop();
  });

  it('stops its timer permanently on NotWriter and rejects every queued envelope', async () => {
    vi.useFakeTimers();
    const { store, reader, receipts } = fixture();
    let attempts = 0;
    const error = new RegistryError('NotWriter', [wsId, zeroAddress, 1]);
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch() {
        attempts++;
        throw error;
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    batcher.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getWorkspace(wsId)).toMatchObject({
      writerState: 'revoked',
      pending: 0,
      lastError: describeRegistryError(error),
    });
    expect(store.listEnvelopes(wsId, 0, 200)[0].status).toBe('rejected');
    await vi.advanceTimersByTimeAsync(100);
    await batcher.tick();
    batcher.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(1);
    await batcher.stop();
  });

  it('reconciles a successful receipt after an ambiguous submission without sending again', async () => {
    const { store, reader } = fixture();
    const item = store.pendingEnvelopes(wsId)[0];
    let attempts = 0;
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch(_id, _count, _head, _digests, options) {
        attempts++;
        options?.onSubmitted?.(zeroHash);
        throw new Error('Receipt connection lost after submission.');
      },
    };
    const receipts = {
      async lookup() {
        return {
          status: 'success' as const,
          appended: [
            {
              wsId,
              index: 0n,
              digest: item.digest,
              head: zeroHash,
              epoch: 0,
              author: zeroAddress,
              txHash: zeroHash,
              blockNumber: 1n,
            },
          ],
        };
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    await batcher.tick();
    expect(store.pendingEnvelopes(wsId)[0].txHash).toBe(zeroHash);
    await batcher.tick();
    expect(attempts).toBe(1);
    expect(store.listEnvelopes(wsId, 0, 200)[0]).toMatchObject({
      status: 'anchored',
      index: 0,
      txHash: zeroHash,
    });
    expect(store.getWorkspace(wsId)?.pending).toBe(0);
    await batcher.stop();
  });

  it('clears a reverted submission before resending its pending digests', async () => {
    const { store, reader } = fixture();
    store.markSubmitted(
      wsId,
      store.pendingEnvelopes(wsId).map((item) => item.digest),
      zeroHash,
    );
    let attempts = 0;
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch() {
        attempts++;
        expect(store.pendingEnvelopes(wsId)[0].txHash).toBeNull();
        throw new Error('A new submission failed before send.');
      },
    };
    const receipts = {
      async lookup() {
        return { status: 'reverted' as const };
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    await batcher.tick();
    expect(attempts).toBe(1);
    expect(store.pendingEnvelopes(wsId)[0].txHash).toBeNull();
    await batcher.stop();
  });

  it('never resends an unresolved hash until its twentieth consecutive not-found tick', async () => {
    const { store, reader } = fixture();
    store.markSubmitted(
      wsId,
      store.pendingEnvelopes(wsId).map((item) => item.digest),
      zeroHash,
    );
    let attempts = 0;
    const writer: Pick<RegistryWriter, 'appendBatch'> = {
      async appendBatch() {
        attempts++;
        expect(store.pendingEnvelopes(wsId)[0].txHash).toBeNull();
        expect(store.getWorkspace(wsId)?.lastError).toBe(
          'A submitted batch was never included; resending.',
        );
        throw new Error('Resubmission transport unavailable.');
      },
    };
    const receipts = {
      async lookup() {
        return null;
      },
    };
    const batcher = createBatcher({ store, reader, writer, receipts, wsId, intervalMs: 10 });
    for (let tick = 0; tick < 19; tick++) await batcher.tick();
    expect(attempts).toBe(0);
    expect(store.pendingEnvelopes(wsId)[0].txHash).toBe(zeroHash);
    await batcher.tick();
    expect(attempts).toBe(1);
    await batcher.stop();
  });
});
