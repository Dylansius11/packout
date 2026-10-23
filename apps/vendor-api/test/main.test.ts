import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { createConnection, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Hex, zeroAddress } from 'viem';
import { afterEach, describe, expect, it } from 'vitest';
import { EnvelopeStore } from '../src/store.ts';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener.');
  return address.port;
}

async function fixture(stallChain = false) {
  const directory = await mkdtemp(join(tmpdir(), 'packout-shutdown-'));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const database = join(directory, 'vendor.sqlite');
  const wsId = `0x${'11'.repeat(32)}` as Hex;
  if (stallChain) {
    const store = new EnvelopeStore(database);
    store.registerWorkspace(wsId, zeroAddress, 0n);
    store.submitEnvelope(wsId, `0x01${'aa'.repeat(40)}`);
    store.close();
  }
  let chainReadStarted!: () => void;
  const readingChain = new Promise<void>((resolve) => {
    chainReadStarted = resolve;
  });
  const rpc = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const { id, method } = JSON.parse(body) as { id: number; method: string };
    if (method === 'eth_call' && stallChain) {
      chainReadStarted();
      return; // Model an RPC connection that never answers the batcher's chain read.
    }
    const results: Record<string, unknown> = {
      eth_chainId: '0x7a69',
      eth_getCode: '0x6000',
      eth_accounts: [`0x${'22'.repeat(20)}`, `0x${'33'.repeat(20)}`],
    };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id, result: results[method] }));
  });
  const rpcPort = await listen(rpc);
  cleanups.push(async () => {
    const closed = new Promise<void>((resolve) => rpc.close(() => resolve()));
    rpc.closeAllConnections();
    await closed;
  });
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  await writeFile(
    join(directory, 'localhost.json'),
    JSON.stringify({
      network: 'localhost',
      chainId: 31337,
      address: `0x${'44'.repeat(20)}`,
      blockNumber: '1',
    }),
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PACKOUT_NETWORK: 'localhost',
    LOCAL_RPC_URL: `http://127.0.0.1:${rpcPort}`,
    PACKOUT_DEPLOYMENTS_DIR: directory,
    DATABASE_PATH: database,
    BATCH_INTERVAL_MS: '10',
    PORT: String(port),
  };
  delete env.NODE_OPTIONS;
  delete env.DEPLOYER_PRIVATE_KEY;
  delete env.VENDOR_WRITER_PRIVATE_KEY;
  // Windows kill bypasses handlers. IPC emits the same signal event on both platforms.
  const child: ChildProcess = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      "import './src/main.ts'; process.on('message', () => process.emit('SIGTERM'));",
    ],
    { cwd, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
  );
  const exited = once(child, 'exit');
  cleanups.push(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  });
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  await new Promise<void>((resolve, reject) => {
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Vendor A API listening')) resolve();
    });
    child.once('error', reject);
    child.once('exit', () => reject(new Error(`API exited before listening: ${stderr}`)));
  });
  return { child, exited, port, readingChain, database, wsId, stderr: () => stderr };
}

describe('vendor process shutdown', () => {
  it('exits cleanly with a connected socket that has not sent any HTTP bytes', async () => {
    const { child, exited, port, stderr } = await fixture();
    const socket: Socket = createConnection(port, '127.0.0.1');
    cleanups.push(async () => {
      socket.destroy();
    });
    await once(socket, 'connect');
    const started = performance.now();
    child.send('shutdown');
    expect(await exited).toEqual([0, null]);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(stderr()).not.toContain('forced');
  }, 20_000);

  it('forces a bounded exit while chain I/O is stuck and preserves pending envelopes', async () => {
    const { child, exited, readingChain, database, wsId, stderr } = await fixture(true);
    await readingChain;
    const started = performance.now();
    child.send('shutdown');
    expect(await exited).toEqual([1, null]);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(stderr()).toMatch(/shutdown.*forced/i);
    const store = new EnvelopeStore(database);
    try {
      expect(store.getWorkspace(wsId)?.pending).toBe(1);
    } finally {
      store.close();
    }
  }, 20_000);
});
