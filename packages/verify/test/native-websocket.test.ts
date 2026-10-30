import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { verifyBundle } from '../src/verify.ts';
import { close, listen, nativeFixture, nativeHash } from './native-fixture.ts';

// Measure connection/I/O deadlines, not cold Vite transformation of the native
// API dependency graph while the full suite competes for CPU.
import '../src/native-connection.ts';

describe('native WebSocket connection lifetime', () => {
  it('cancels a stalled upgrade and closes the actual socket before returning a failed proof', async () => {
    const fixture = nativeFixture();
    const sockets = new Set<Duplex>();
    let upgraded = false;
    let onSocketClosed: () => void;
    const socketClosed = new Promise<void>((resolve) => {
      onSocketClosed = resolve;
    });
    const server = createServer((_request, response) => {
      response.writeHead(400);
      response.end();
    });
    server.on('upgrade', (_request, socket) => {
      upgraded = true;
      sockets.add(socket);
      socket.once('close', () => {
        sockets.delete(socket);
        onSocketClosed();
      });
      // Complete TCP EOF; otherwise this raw upgraded test socket stays
      // artificially half-open after the client has already terminated it.
      socket.on('end', () => socket.end());
      socket.on('data', () => {
        /* Keep the accepted upgrade stalled without replying. */
      });
    });
    let guardTimer: NodeJS.Timeout | undefined;
    // Platform integration intentionally uses the real clock: fake timers cannot
    // prove that the real transport/API cancels Node's pending upgrade socket.
    const guard = new Promise<never>((_, reject) => {
      guardTimer = setTimeout(
        () => reject(new Error('Native WebSocket upgrade did not cancel within 20 seconds.')),
        20_000,
      );
    });
    try {
      const rpc = await listen(fixture.server);
      const nativeRpc = (await listen(server)).replace('http:', 'ws:');
      const report = await Promise.race([
        verifyBundle({
          bundle: fixture.bundle,
          rpc,
          native: { blockHashes: [nativeHash], rpc: nativeRpc },
        }),
        guard,
      ]);
      expect(upgraded).toBe(true);
      expect(report.ok).toBe(false);
      expect(report.steps[3]).toMatchObject({
        status: 'fail',
        message: expect.stringMatching(/timed out|timeout/i),
      });
      expect(report.steps[4].status).toBe('not checked');
      expect(report.trust).toContain(nativeRpc);
      await Promise.race([socketClosed, guard]);
      expect(sockets.size).toBe(0);
    } finally {
      clearTimeout(guardTimer);
      // Upgraded sockets are not covered by server.closeAllConnections(). This
      // cleanup runs only after the assertions, so it cannot satisfy cancellation.
      for (const socket of sockets) socket.destroy();
      await close(server);
      await close(fixture.server);
    }
  }, 25_000);

  it('terminates an open peer that answers neither RPC requests nor WebSocket close frames', async () => {
    const fixture = nativeFixture();
    const sockets = new Set<Duplex>();
    let receivedFrame = false;
    let onSocketClosed: () => void;
    const socketClosed = new Promise<void>((resolve) => {
      onSocketClosed = resolve;
    });
    const server = createServer();
    server.on('upgrade', (request, socket) => {
      const key = request.headers['sec-websocket-key'];
      if (typeof key !== 'string') {
        socket.destroy();
        return;
      }
      const accept = createHash('sha1')
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64');
      sockets.add(socket);
      socket.once('close', () => {
        sockets.delete(socket);
        onSocketClosed();
      });
      // Acknowledge TCP termination, never the WebSocket close handshake.
      // This avoids keeping the raw test socket artificially half-open.
      socket.on('end', () => socket.end());
      socket.on('data', () => {
        receivedFrame = true;
        // Deliberately ignore every RPC/control frame, including WS close.
      });
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
    });
    let guardTimer: NodeJS.Timeout | undefined;
    // Real-clock integration is required to observe actual socket termination;
    // mocked timers cannot exercise the platform WebSocket close lifecycle.
    const guard = new Promise<never>((_, reject) => {
      guardTimer = setTimeout(
        () => reject(new Error('Open native WebSocket peer was not terminated within 20 seconds.')),
        20_000,
      );
    });
    try {
      const rpc = await listen(fixture.server);
      const nativeRpc = (await listen(server)).replace('http:', 'ws:');
      const report = await Promise.race([
        verifyBundle({
          bundle: fixture.bundle,
          rpc,
          native: { blockHashes: [nativeHash], rpc: nativeRpc },
        }),
        guard,
      ]);
      expect(receivedFrame).toBe(true);
      expect(report.ok).toBe(false);
      expect(report.steps[3]).toMatchObject({
        status: 'fail',
        message: expect.stringMatching(/timed out|timeout/i),
      });
      expect(report.steps[4].status).toBe('not checked');
      await Promise.race([socketClosed, guard]);
      expect(sockets.size).toBe(0);
    } finally {
      clearTimeout(guardTimer);
      // Cleanup cannot satisfy the closure assertion above.
      for (const socket of sockets) socket.destroy();
      await close(server);
      await close(fixture.server);
    }
  }, 25_000);
});
