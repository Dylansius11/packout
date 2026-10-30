import { createServer } from 'node:http';
import type * as PolkadotApi from '@polkadot/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeHttpProvider } from '../src/native-http.ts';
import { verifyBundle } from '../src/verify.ts';
import { close, listen, nativeFixture, nativeHash } from './native-fixture.ts';

const connection = vi.hoisted(() => ({
  api: undefined as unknown,
  stage: 'initialization' as 'initialization' | 'proof',
  disconnected: false,
}));
// Replace metadata-heavy API decoration only. The production native provider,
// fetch, local HTTP socket, request cancellation and verifier remain real.
vi.mock('@polkadot/api', async (importOriginal) => {
  const original = await importOriginal<typeof PolkadotApi>();
  return {
    ...original,
    ApiPromise: class ApiPromise {
      readonly isReadyOrError: Promise<this>;
      readonly rpc: { chain: { getFinalizedHead(): Promise<unknown> } };
      readonly disconnect: () => Promise<void>;
      constructor({ provider }: { provider: PolkadotApi.HttpProvider }) {
        Object.assign(this, connection.api);
        this.rpc = {
          chain: { getFinalizedHead: () => provider.send('chain_getFinalizedHead', []) },
        };
        this.disconnect = async () => {
          await provider.disconnect();
          connection.disconnected = true;
        };
        this.isReadyOrError =
          connection.stage === 'initialization'
            ? provider.send('system_chain', []).then(() => this)
            : Promise.resolve(this);
      }
    },
  };
});

let fixture = nativeFixture();
let rpc: string;
let nativeRpc: string;
let rejectInitialization = false;
let requestCancelled: Promise<void>;
let requestReceived: Promise<void>;
let rpcResponse: ((id: number) => unknown) | undefined;
let nativeServer = createServer();

beforeEach(async () => {
  fixture = nativeFixture();
  connection.api = fixture.nativeApi;
  connection.stage = 'initialization';
  connection.disconnected = false;
  rejectInitialization = false;
  rpcResponse = undefined;
  rpc = await listen(fixture.server);
  let onCancellation: () => void;
  requestCancelled = new Promise<void>((resolve) => {
    onCancellation = resolve;
  });
  let onRequest: () => void;
  requestReceived = new Promise<void>((resolve) => {
    onRequest = resolve;
  });
  nativeServer = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    onRequest();
    if (rejectInitialization) {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Native RPC unavailable' }));
      return;
    }
    if (rpcResponse) {
      const { id } = JSON.parse(body);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(rpcResponse(id)));
      return;
    }
    // Intentionally never return headers or a response body. Only cancellation
    // of the actual production request can close this response before cleanup.
    response.once('close', onCancellation);
  });
  nativeRpc = await listen(nativeServer);
});
afterEach(async () => {
  await close(nativeServer);
  await close(fixture.server);
});

describe('native HTTP request lifetime', () => {
  it('reports initialization rejection as a failed proof and disconnects the constructed API', async () => {
    rejectInitialization = true;
    const report = await verifyBundle({
      bundle: fixture.bundle,
      rpc,
      native: { blockHashes: [nativeHash], rpc: nativeRpc },
    });
    expect(report.ok).toBe(false);
    expect(report.steps[3].status).toBe('fail');
    expect(report.steps[4].status).toBe('not checked');
    expect(connection.disconnected).toBe(true);
  });

  it.each(['initialization', 'proof'] as const)(
    'cancels a stalled native %s request before returning a failed proof',
    async (stage) => {
      connection.stage = stage;
      let guardTimer: NodeJS.Timeout | undefined;
      // This is a test guard, not a substitute for production cancellation:
      // both report settlement and server-observed socket closure must happen.
      // Deliberate platform-clock integration: mocked timers cannot exercise
      // Node fetch/AbortSignal deadlines and actual server-side socket closure.
      const guard = new Promise<never>((_, reject) => {
        guardTimer = setTimeout(
          () => reject(new Error('Native request did not cancel within 20 seconds.')),
          20_000,
        );
      });
      try {
        const report = await Promise.race([
          verifyBundle({
            bundle: fixture.bundle,
            rpc,
            native: { blockHashes: [nativeHash], rpc: nativeRpc },
          }),
          guard,
        ]);
        expect(report.ok).toBe(false);
        expect(report.steps[3].status).toBe('fail');
        expect(report.steps[4].status).toBe('not checked');
        expect(connection.disconnected).toBe(true);
        await Promise.race([requestCancelled, guard]);
      } finally {
        clearTimeout(guardTimer);
      }
    },
    25_000,
  );

  it('returns a valid native JSON-RPC result without its response envelope', async () => {
    rpcResponse = (id) => ({
      jsonrpc: '2.0',
      id,
      result: { peers: 2, isSyncing: false, shouldHavePeers: true },
    });
    const provider = new NativeHttpProvider(nativeRpc);
    try {
      await expect(provider.send('system_health', [])).resolves.toEqual({
        peers: 2,
        isSyncing: false,
        shouldHavePeers: true,
      });
    } finally {
      await provider.disconnect();
    }
  });

  it('preserves structured JSON-RPC rejection code and data', async () => {
    rpcResponse = (id) => ({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: 'Native method rejected',
        data: { reason: 'not ready' },
      },
    });
    const provider = new NativeHttpProvider(nativeRpc);
    try {
      await expect(provider.send('chain_getHeader', [])).rejects.toMatchObject({
        code: -32000,
        message: 'Native method rejected',
        data: { reason: 'not ready' },
      });
    } finally {
      await provider.disconnect();
    }
  });

  it.each(['wrong-id', 'ambiguous', 'missing-result', 'wrong-version', 'invalid-error-code'])(
    'rejects %s JSON-RPC responses instead of admitting their result',
    async (kind) => {
      rpcResponse = (id) => {
        if (kind === 'wrong-id') return { jsonrpc: '2.0', id: id + 1, result: 'untrusted' };
        if (kind === 'ambiguous')
          return {
            jsonrpc: '2.0',
            id,
            result: 'untrusted',
            error: { code: -1, message: 'failure' },
          };
        if (kind === 'missing-result') return { jsonrpc: '2.0', id };
        if (kind === 'wrong-version') return { jsonrpc: '1.0', id, result: 'untrusted' };
        return { jsonrpc: '2.0', id, error: { code: 'invalid', message: 'failure' } };
      };
      const provider = new NativeHttpProvider(nativeRpc);
      try {
        await expect(provider.send('chain_getHeader', [])).rejects.toThrow(/response/i);
      } finally {
        await provider.disconnect();
      }
    },
  );

  it('disconnecting a cloned provider cancels its pending HTTP request', async () => {
    const original = new NativeHttpProvider(nativeRpc);
    const provider = original.clone();
    try {
      const rejection = expect(provider.send('chain_getHeader', [])).rejects.toThrow(
        /disconnect|cancel/i,
      );
      await requestReceived;
      await provider.disconnect();
      await rejection;
      await requestCancelled;
      await expect(provider.send('chain_getHeader', [])).rejects.toThrow(/disconnected/i);
    } finally {
      await provider.disconnect();
      await original.disconnect();
    }
  });
});
