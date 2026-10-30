import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { NativeWsProvider } from '../src/native-ws.ts';
import { close, GENESIS, listen, nativeHash } from './native-fixture.ts';

let server = createServer();
let websocketServer: WebSocketServer;
let provider: NativeWsProvider;
let peerClosed: Promise<void>;

beforeEach(async () => {
  server = createServer();
  websocketServer = new WebSocketServer({ server });
  let onPeerClosed: () => void;
  peerClosed = new Promise<void>((resolve) => {
    onPeerClosed = resolve;
  });
  websocketServer.on('connection', (peer) => {
    let firstId: number | undefined;
    peer.once('close', onPeerClosed);
    peer.on('message', (data) => {
      const call = JSON.parse(data.toString());
      if (call.method === 'chain_getFinalizedHead') {
        firstId = call.id;
      } else if (call.method === 'chain_getBlockHash') {
        // Return simultaneous requests out of order; each must retain its ID.
        peer.send(JSON.stringify({ jsonrpc: '2.0', id: call.id, result: GENESIS }));
        peer.send(JSON.stringify({ jsonrpc: '2.0', id: firstId, result: nativeHash }));
      } else if (call.method === 'chain_getHeader') {
        peer.send(JSON.stringify({ jsonrpc: '2.0', id: call.id + 1, result: null }));
      } else if (call.method !== 'chain_silent') {
        peer.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: call.id,
            error: {
              code: -32601,
              message: 'Method not found',
              data: { phase: 'read' },
            },
          }),
        );
      }
    });
  });
  const endpoint = (await listen(server)).replace('http:', 'ws:');
  provider = new NativeWsProvider(endpoint);
  await provider.connect();
});
afterEach(async () => {
  await provider.disconnect();
  for (const peer of websocketServer.clients) peer.terminate();
  await new Promise<void>((resolve) => websocketServer.close(() => resolve()));
  await close(server);
});

describe('non-subscription native WebSocket RPC', () => {
  it('delivers simultaneous responses to their callers and preserves structured RPC errors', async () => {
    const [finalized, genesis] = await Promise.all([
      provider.send('chain_getFinalizedHead', []),
      provider.send('chain_getBlockHash', [0]),
    ]);
    expect(finalized).toBe(nativeHash);
    expect(genesis).toBe(GENESIS);
    await expect(provider.send('chain_missingMethod', [])).rejects.toMatchObject({
      code: -32601,
      message: 'Method not found',
      data: { phase: 'read' },
    });
    expect(provider.isConnected).toBe(true);
  });

  it('rejects an unmatched response instead of assigning it to a pending caller', async () => {
    await expect(provider.send('chain_getHeader', [])).rejects.toThrow(
      /mismatched.*response|response.*identifier/i,
    );
    await peerClosed;
    expect(provider.isConnected).toBe(false);
  });

  it('terminates an established socket when a later RPC request exceeds its own deadline', async () => {
    let guardTimer: NodeJS.Timeout | undefined;
    // Real-clock integration verifies per-request cancellation after connection,
    // independent of API initialization or fake platform/socket timers.
    const guard = new Promise<never>((_, reject) => {
      guardTimer = setTimeout(
        () =>
          reject(new Error('Established native RPC request did not terminate within 20 seconds.')),
        20_000,
      );
    });
    try {
      await expect(Promise.race([provider.send('chain_silent', []), guard])).rejects.toThrow(
        /timed out after 15 seconds/i,
      );
      await Promise.race([peerClosed, guard]);
      expect(provider.isConnected).toBe(false);
    } finally {
      clearTimeout(guardTimer);
    }
  }, 25_000);
});
