import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  concat,
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  parseAbiItem,
  stringToHex,
} from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nextHead, ZERO_HEAD } from '../src/head.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
let directory: string;
let rpc: string;
const wsId = `0x${'11'.repeat(32)}` as const;
const owner = `0x${'22'.repeat(20)}` as const;
const registry = `0x${'33'.repeat(20)}` as const;
const schemaId = keccak256(stringToHex('packout.journal/1'));
const key = new Uint8Array(32).fill(7);
const nonce = new Uint8Array(24).fill(3);
const op = {
  v: 1,
  wsId,
  opId: `0x${'44'.repeat(16)}`,
  ts: 100,
  author: { memberId: `0x${'55'.repeat(16)}`, name: 'Dina' },
  type: 'issue.create',
  body: { title: 'Independent CLI', description: '' },
};
const envelope = bytesToHex(
  concat([
    new Uint8Array([1]),
    nonce,
    xchacha20poly1305(key, nonce, new Uint8Array(32).fill(0x11)).encrypt(
      new TextEncoder().encode(JSON.stringify(op)),
    ),
  ]),
);
const digest = keccak256(envelope);
const head = nextHead(wsId, 0n, ZERO_HEAD, digest);
const bundle = {
  format: 'packout.bundle/1',
  chainId: 420420777,
  registry,
  wsId,
  schemaId,
  envelopes: [envelope],
  checkpoint: { count: 1, head, blockNumber: 100 },
};
const event = parseAbiItem(
  'event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head)',
);
const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  const call = JSON.parse(body);
  let result: unknown;
  if (call.method === 'eth_chainId') result = '0x190f1ca9';
  else if (call.method === 'eth_blockNumber') result = '0x64';
  else if (call.method === 'eth_call')
    result = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint32' },
        { type: 'uint64' },
        { type: 'bytes32' },
        { type: 'bytes32' },
      ],
      [owner, 0, 1n, head, schemaId],
    );
  else if (call.method === 'eth_getLogs')
    result = [
      {
        address: registry,
        topics: encodeEventTopics({
          abi: [event],
          eventName: 'Appended',
          args: { wsId, index: 0n, author: owner },
        }),
        data: encodeAbiParameters(
          [{ type: 'uint32' }, { type: 'bytes32' }, { type: 'bytes32' }],
          [0, digest, head],
        ),
        blockNumber: '0x64',
        blockHash: wsId,
        transactionHash: wsId,
        transactionIndex: '0x0',
        logIndex: '0x0',
        removed: false,
      },
    ];
  else {
    response.writeHead(400);
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
});

async function run(args: string[]) {
  const child = spawn(process.execPath, [cli, ...args], { cwd: directory });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  return { code, stdout, stderr };
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'packout-verify-'));
  await writeFile(join(directory, 'bundle.json'), JSON.stringify(bundle));
  await writeFile(join(directory, 'bad.json'), '{');
  await writeFile(join(directory, 'key.txt'), `${Buffer.from(key).toString('base64url')}\n`);
  await writeFile(join(directory, 'wrong.txt'), Buffer.alloc(32, 8).toString('base64url'));
  await writeFile(join(directory, 'invalid.txt'), 'not a key');
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test RPC did not listen');
  rpc = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(directory, { recursive: true, force: true });
});

describe('packout-verify executable', () => {
  it('prints six passes and RPC trust without disclosing key or plaintext', async () => {
    const result = await run(['bundle.json', '--key', 'key.txt', '--rpc', rpc]);
    expect(result.code).toBe(0);
    expect(result.stdout.match(/PASS/g)).toHaveLength(6);
    expect(result.stdout).toContain(`Trusts RPC ${rpc}`);
    expect(result.stdout).not.toContain(Buffer.from(key).toString('base64url'));
    expect(result.stdout).not.toContain(op.body.title);
    expect(result.stderr).toBe('');
  });
  it('emits one JSON report with decryption skipped without a key', async () => {
    const result = await run(['bundle.json', '--rpc', rpc, '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      rpc,
      steps: [
        { status: 'pass' },
        { status: 'pass' },
        { status: 'pass' },
        { status: 'pass' },
        { status: 'pass' },
        { status: 'skipped' },
      ],
    });
  });
  it.each(['wrong.txt', 'invalid.txt', 'missing.txt'])('fails decrypt with %s', async (file) => {
    const result = await run(['bundle.json', '--key', file, '--rpc', rpc, '--json']);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout).steps[5].status).toBe('fail');
  });
  it.each(['bad.json', 'missing.json'])(
    'reports format failure and later steps not checked for %s',
    async (file) => {
      const result = await run([file, '--json']);
      expect(result.code).toBe(1);
      const report = JSON.parse(result.stdout);
      expect(report.steps.map((step: { status: string }) => step.status)).toEqual([
        'fail',
        'not checked',
        'not checked',
        'not checked',
        'not checked',
        'not checked',
      ]);
    },
  );
  it.each(
    [
      [],
      ['bundle.json', '--unknown'],
      ['bundle.json', '--key'],
      ['bundle.json', '--rpc', 'file:///private'],
      ['bundle.json', 'extra.json'],
    ].map((args) => ({ args })),
  )('rejects invalid arguments %#', async ({ args }) => {
    const result = await run(args);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Usage:/);
  });
});
