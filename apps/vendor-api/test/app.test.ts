import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envelopeDigest } from '@packout/sdk';
import { type Address, type Hex, hexToBytes, zeroHash } from 'viem';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type VendorChain } from '../src/app.ts';
import { EnvelopeStore } from '../src/store.ts';

const wsId = `0x${'11'.repeat(32)}` as Hex;
const unknown = `0x${'22'.repeat(32)}` as Hex;
const writer = `0x${'33'.repeat(20)}` as Address;
const registry = `0x${'44'.repeat(20)}` as Address;
const envelope = (byte: string) => `0x01${byte.repeat(40)}` as Hex;
const cleanup: { store: EnvelopeStore; directory: string }[] = [];

function fixture(overrides: Partial<VendorChain> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'packout-api-'));
  const databasePath = join(directory, 'store.sqlite');
  const store = new EnvelopeStore(databasePath);
  cleanup.push({ store, directory });
  const chain: VendorChain = {
    chainId: 31337,
    registry,
    writer,
    async getWorkspace(id) {
      return id === wsId
        ? { owner: writer, epoch: 0, count: 7n, head: zeroHash, schemaId: zeroHash }
        : null;
    },
    async canWrite() {
      return true;
    },
    ...overrides,
  };
  return { app: createApp({ store, chain }), store, databasePath };
}

const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

afterEach(() => {
  for (const { store, directory } of cleanup.splice(0)) {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Vendor API over SQLite', () => {
  it('reports the selected chain and vendor writer without secrets', async () => {
    const { app } = fixture();
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, chainId: 31337, registry, writer });
  });

  it('registers an authorized workspace idempotently and exposes its status', async () => {
    const { app } = fixture();
    const created = await app.request('/workspaces', post({ wsId }));
    expect(created.status).toBe(201);
    const expected = {
      workspace: {
        wsId,
        writer,
        writerState: 'active',
        pending: 0,
        anchoredCount: 0,
        chainCount: 7,
        lastError: null,
      },
    };
    expect(await created.json()).toEqual(expected);
    const repeated = await app.request('/workspaces', post({ wsId }));
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual(expected);
    expect(await (await app.request(`/workspaces/${wsId}`)).json()).toEqual(expected);
  });

  it('registers only once when concurrent requests race their chain checks', async () => {
    const { app, store } = fixture();
    const results = await Promise.all([
      app.request('/workspaces', post({ wsId })),
      app.request('/workspaces', post({ wsId })),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(store.listWorkspaces()).toHaveLength(1);
  });

  it('refuses unknown chain workspaces and a writer that was never granted', async () => {
    const { app, store } = fixture({
      async canWrite() {
        return false;
      },
    });
    const denied = await app.request('/workspaces', post({ wsId }));
    expect(denied.status).toBe(409);
    expect((await denied.json()).error.code).toBe('writer-not-granted');
    expect(store.getWorkspace(wsId)).toBeNull();
    const missing = await app.request('/workspaces', post({ wsId: unknown }));
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('unknown-workspace');
  });

  it('returns unknown-workspace for every unregistered workspace endpoint', async () => {
    const { app } = fixture();
    for (const [path, options] of [
      [`/workspaces/${unknown}`, undefined],
      [`/workspaces/${unknown}/envelopes`, undefined],
      [`/workspaces/${unknown}/envelopes`, post({ envelope: envelope('aa') })],
    ] as const) {
      const response = await app.request(path, options);
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe('unknown-workspace');
    }
  });

  it('stores ciphertext and digest once, preserving the arrival timestamp on resubmit', async () => {
    const { app } = fixture();
    await app.request('/workspaces', post({ wsId }));
    const response = await app.request(
      `/workspaces/${wsId}/envelopes`,
      post({ envelope: envelope('aa') }),
    );
    expect(response.status).toBe(202);
    const { item } = await response.json();
    expect(item).toEqual({
      seq: 1,
      digest: envelopeDigest(hexToBytes(envelope('aa'))),
      envelope: envelope('aa'),
      status: 'pending',
      index: null,
      txHash: null,
      blockNumber: null,
      receivedAt: expect.any(String),
    });
    expect(Number.isFinite(Date.parse(item.receivedAt))).toBe(true);
    const repeated = await app.request(
      `/workspaces/${wsId}/envelopes`,
      post({ envelope: envelope('aa') }),
    );
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual({ item });
    expect((await (await app.request(`/workspaces/${wsId}`)).json()).workspace.pending).toBe(1);
  });

  it('paginates arrival sequence with after and limit, returning the last cursor', async () => {
    const { app } = fixture();
    await app.request('/workspaces', post({ wsId }));
    for (const byte of ['aa', 'bb', 'cc'])
      await app.request(`/workspaces/${wsId}/envelopes`, post({ envelope: envelope(byte) }));
    const first = await (await app.request(`/workspaces/${wsId}/envelopes?limit=2`)).json();
    expect(first.items.map((item: { seq: number }) => item.seq)).toEqual([1, 2]);
    expect(first.nextAfter).toBe(2);
    const next = await (await app.request(`/workspaces/${wsId}/envelopes?after=2&limit=2`)).json();
    expect(next.items.map((item: { seq: number }) => item.seq)).toEqual([3]);
    expect(next.nextAfter).toBe(3);
    expect(await (await app.request(`/workspaces/${wsId}/envelopes?after=3`)).json()).toEqual({
      items: [],
      nextAfter: 3,
    });
  });

  it('rejects bad pagination and workspace ids through JSON error responses', async () => {
    const { app } = fixture();
    await app.request('/workspaces', post({ wsId }));
    for (const query of [
      'after=-1',
      'after=1.5',
      'after=no',
      'limit=0',
      'limit=501',
      'limit=no',
      'limit=1&limit=2',
      'after=9007199254740992',
    ]) {
      const response = await app.request(`/workspaces/${wsId}/envelopes?${query}`);
      expect(response.status, query).toBe(400);
      expect((await response.json()).error.code).toBe('invalid-input');
    }
    expect((await app.request('/workspaces/not-a-workspace')).status).toBe(400);
  });

  it('accepts only lowercase version-one envelopes of 41 bytes through 16 KiB', async () => {
    const { app } = fixture();
    await app.request('/workspaces', post({ wsId }));
    for (const invalid of [
      '0x',
      `0x02${'aa'.repeat(40)}`,
      `0x01${'aa'.repeat(39)}`,
      `0x01${'AA'.repeat(40)}`,
      `0x01${'aa'.repeat(16_384)}`,
      `0x01${'aa'.repeat(40)}f`,
      'not hex',
    ]) {
      const response = await app.request(
        `/workspaces/${wsId}/envelopes`,
        post({ envelope: invalid }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('invalid-input');
    }
    const largest = await app.request(
      `/workspaces/${wsId}/envelopes`,
      post({ envelope: `0x01${'ab'.repeat(16_383)}` }),
    );
    expect(largest.status).toBe(202);
  });

  it('never accepts a workspace key or unexpected JSON fields', async () => {
    const { app } = fixture();
    expect((await app.request('/workspaces', post({ wsId, key: 'not accepted' }))).status).toBe(
      400,
    );
    await app.request('/workspaces', post({ wsId }));
    expect(
      (
        await app.request(
          `/workspaces/${wsId}/envelopes`,
          post({ envelope: envelope('aa'), workspaceKey: 'not accepted' }),
        )
      ).status,
    ).toBe(400);
    const malformed = await app.request('/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe('invalid-input');
  });

  it('exposes terminal revocation and rejects new submissions without storing anything', async () => {
    const { app, store } = fixture();
    await app.request('/workspaces', post({ wsId }));
    await app.request(`/workspaces/${wsId}/envelopes`, post({ envelope: envelope('aa') }));
    store.markRevoked(wsId, 'Write access revoked by the workspace owner.');
    const response = await app.request(
      `/workspaces/${wsId}/envelopes`,
      post({ envelope: envelope('bb') }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('writer-revoked');
    const view = await (await app.request(`/workspaces/${wsId}`)).json();
    expect(view.workspace).toMatchObject({
      writerState: 'revoked',
      pending: 0,
      anchoredCount: 0,
      lastError: 'Write access revoked by the workspace owner.',
    });
    const list = await (await app.request(`/workspaces/${wsId}/envelopes`)).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].status).toBe('rejected');
  });

  it('persists envelopes and pending submission hashes across database reopen', async () => {
    const { app, store, databasePath } = fixture();
    await app.request('/workspaces', post({ wsId }));
    const { item } = await (
      await app.request(`/workspaces/${wsId}/envelopes`, post({ envelope: envelope('aa') }))
    ).json();
    store.markSubmitted(wsId, [item.digest], zeroHash);
    store.close();
    const reopened = new EnvelopeStore(databasePath);
    try {
      expect(reopened.listEnvelopes(wsId, 0, 200)[0]).toEqual({ ...item, txHash: zeroHash });
      expect(reopened.getWorkspace(wsId)?.pending).toBe(1);
    } finally {
      reopened.close();
    }
  });

  it('does not partially anchor a batch with a missing digest event', async () => {
    const { store } = fixture();
    store.registerWorkspace(wsId, writer, 0n);
    const first = store.submitEnvelope(wsId, envelope('aa')).item;
    const second = store.submitEnvelope(wsId, envelope('bb')).item;
    expect(() =>
      store.markAnchored(
        wsId,
        [first.digest, second.digest],
        [
          {
            wsId,
            digest: first.digest,
            index: 0n,
            author: writer,
            epoch: 0,
            head: zeroHash,
            txHash: zeroHash,
            blockNumber: 1n,
          },
        ],
      ),
    ).toThrow(/event/i);
    expect(store.pendingEnvelopes(wsId)).toHaveLength(2);
    expect(store.getWorkspace(wsId)?.anchoredCount).toBe(0);
  });

  it('permits the configured Vendor A browser origin through CORS', async () => {
    const { app } = fixture();
    const response = await app.request('/health', { headers: { origin: 'http://localhost:5173' } });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
