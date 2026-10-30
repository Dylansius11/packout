import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { close, listen, nativeFixture, nativeHash } from './native-fixture.ts';

const connection = vi.hoisted(() => ({ api: undefined as unknown }));
// Only native connection/transport is replaced; the CLI parses actual files,
// talks to the local EVM server and verifies/decodes real wire event payloads.
vi.mock('@polkadot/api', () => ({
  ApiPromise: class ApiPromise {
    constructor() {
      Object.assign(this, connection.api);
    }
    get isReadyOrError() {
      return Promise.resolve(this);
    }
  },
  HttpProvider: class HttpProvider {},
}));
// CLI behavior tests replace the external WS connection; the separate socket
// tests exercise this transport against real CONNECTING and OPEN peers.
vi.mock('../src/native-ws.ts', () => ({
  NativeWsProvider: class NativeWsProvider {
    async connect() {}
    async disconnect() {}
  },
}));
let fixture = nativeFixture();
let directory: string;
let rpc: string;
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const scratchRoot = fileURLToPath(new URL('../../../out/verify-tests/', import.meta.url));

beforeEach(async () => {
  fixture = nativeFixture();
  connection.api = fixture.nativeApi;
  rpc = await listen(fixture.server);
  await mkdir(scratchRoot, { recursive: true });
  directory = await mkdtemp(join(scratchRoot, 'native-cli-'));
  await writeFile(join(directory, 'bundle.json'), JSON.stringify(fixture.bundle));
  await writeFile(
    join(directory, 'blocks.json'),
    JSON.stringify([nativeHash, `0x${nativeHash.slice(2).toUpperCase()}`]),
  );
  await writeFile(join(directory, 'key.txt'), Buffer.from(fixture.key).toString('base64url'));
});
afterEach(async () => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  await close(fixture.server);
  await rm(directory, { recursive: true, force: true });
});

async function run(extra: string[] = []) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((value) => {
    stdout.push(String(value));
  });
  vi.spyOn(console, 'error').mockImplementation((value) => {
    stderr.push(String(value));
  });
  process.argv = [
    process.execPath,
    'packout-verify',
    join(directory, 'bundle.json'),
    '--native-blocks',
    join(directory, 'blocks.json'),
    '--rpc',
    rpc,
    '--json',
    ...extra,
  ];
  process.exitCode = undefined;
  vi.resetModules();
  // Re-evaluate the executable boundary only after argv and node transport are set;
  // a static import would execute its top-level main before those test inputs.
  await import('../src/cli.ts');
  return { code: process.exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

describe('native CLI opt-in and resource lifecycle', () => {
  it('reports RPC trust without claiming decryption and disconnects', async () => {
    const endpoint = 'ws://native.test';
    const result = await run(['--native-rpc', endpoint]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.steps[5].status).toBe('skipped');
    expect(report.trust).toContain(endpoint);
    expect(report.trust).toContain(rpc);
    expect(report.trust).toMatch(/not light-client/i);
    expect(fixture.state.disconnected).toBe(true);
    expect(result.stderr).toBe('');
  });

  it('verifies keyed history without disclosing secrets and disconnects', async () => {
    const endpoint = 'wss://native.test';
    const result = await run(['--native-rpc', endpoint, '--key', join(directory, 'key.txt')]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.steps.map((step: { status: string }) => step.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
    ]);
    expect(report.trust).toContain(endpoint);
    expect(result.stdout).not.toContain(Buffer.from(fixture.key).toString('base64url'));
    expect(result.stdout).not.toContain('Private native history');
    expect(fixture.state.disconnected).toBe(true);
  });

  it('accepts exactly 4096 sidecar entries and normalizes repeated references', async () => {
    await writeFile(join(directory, 'blocks.json'), JSON.stringify(Array(4096).fill(nativeHash)));
    const result = await run();
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).ok).toBe(true);
    expect(fixture.state.disconnected).toBe(true);
  });

  it('reports native chain proof failure as exit 1 and still disconnects', async () => {
    fixture.state.canonical = `0x${'00'.repeat(32)}`;
    const result = await run();
    expect(result.code).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(false);
    expect(report.steps[3].status).toBe('fail');
    expect(fixture.state.disconnected).toBe(true);
  });
});
