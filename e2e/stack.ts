import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const contracts = join(root, 'contracts');
const hardhat = join(contracts, 'node_modules/hardhat/dist/src/cli.js');
const rpc = 'http://127.0.0.1:8645';
const api = 'http://127.0.0.1:8887';
const origin = 'http://127.0.0.1:5273';
const temporary = await mkdtemp(join(tmpdir(), 'packout-e2e-'));
const children: ChildProcess[] = [];
let frontend: ViteDevServer | undefined;
let closing = false;
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  PACKOUT_NETWORK: 'localhost',
  LOCAL_RPC_URL: rpc,
  PACKOUT_DEPLOYMENTS_DIR: temporary,
  DATABASE_PATH: join(temporary, 'vendor.sqlite'),
  PORT: '8887',
  CORS_ORIGIN: origin,
  BATCH_INTERVAL_MS: '500',
  VITE_PACKOUT_NETWORK: 'localhost',
  VITE_LOCAL_RPC_URL: rpc,
  VITE_VENDOR_API_URL: api,
};
// Use unlocked local accounts, never an inherited testnet key or an env-file loader.
delete environment.DEPLOYER_PRIVATE_KEY;
delete environment.VENDOR_WRITER_PRIVATE_KEY;
delete environment.NODE_OPTIONS;

async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await frontend?.close();
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }),
  );
  await rm(temporary, { recursive: true, force: true });
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

function launch(args: string[], cwd: string): ChildProcess {
  const child = spawn(process.execPath, args, {
    cwd,
    env: environment,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  children.push(child);
  child.once('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
    void shutdown();
  });
  return child;
}

async function reserveCheck(port: number): Promise<void> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}

async function waitFor(url: string, child: ChildProcess, rpcRequest = false): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null || closing) {
      throw new Error(`E2E service exited before becoming ready: ${url}`);
    }
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000),
        ...(rpcRequest
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
            }
          : {}),
      });
      if (response.ok) {
        if (!rpcRequest) return;
        const body: unknown = await response.json();
        if (body && typeof body === 'object' && 'result' in body && body.result === '0x7a69')
          return;
      }
    } catch {
      // The process is still starting; the bounded deadline reports a real failure.
    }
    await delay(100);
  }
  throw new Error(`E2E service did not become ready within 60 seconds: ${url}`);
}

try {
  await Promise.all([8645, 8887, 5273].map(reserveCheck));
  const node = launch([hardhat, 'node', '--hostname', '127.0.0.1', '--port', '8645'], contracts);
  await waitFor(rpc, node, true);
  const deploy = launch([hardhat, 'run', 'scripts/deploy.ts', '--network', 'localhost'], contracts);
  const [code] = await once(deploy, 'exit');
  if (code !== 0) throw new Error(`E2E registry deployment failed (exit ${code}).`);
  const deployment = await readFile(join(temporary, 'localhost.json'), 'utf8');
  const vendor = launch(['--import', 'tsx', 'src/main.ts'], join(root, 'apps/vendor-api'));
  await waitFor(`${api}/health`, vendor);
  Object.assign(process.env, {
    VITE_PACKOUT_NETWORK: environment.VITE_PACKOUT_NETWORK,
    VITE_LOCAL_RPC_URL: environment.VITE_LOCAL_RPC_URL,
    VITE_VENDOR_API_URL: environment.VITE_VENDOR_API_URL,
  });
  frontend = await createServer({
    root: join(root, 'apps/vendor-a'),
    configFile: join(root, 'apps/vendor-a/vite.config.ts'),
    // Never load .env files; this directory contains only this run's deployment and database.
    envDir: temporary,
    define: { 'import.meta.env.VITE_PACKOUT_DEPLOYMENT': deployment },
    server: { host: '127.0.0.1', port: 5273, strictPort: true },
  });
  await frontend.listen();
  for (const [name, child] of [
    ['chain', node],
    ['vendor API', vendor],
  ] as const) {
    child.once('exit', (exitCode) => {
      if (!closing) {
        console.error(`E2E ${name} exited unexpectedly (exit ${exitCode}).`);
        process.exitCode = 1;
        void shutdown();
      }
    });
  }
  console.log(`Isolated E2E stack ready at ${origin}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  await shutdown();
}
