import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  type AppendedEvent,
  type ChainReader,
  createBundle,
  createOp,
  decodeOp,
  JOURNAL_SCHEMA_ID,
  parseBundle,
  verifyBundle as sdkVerify,
  sealOp,
  type WorkspaceOnChain,
} from '@packout/sdk';
import { bytesToHex, concat, type Hex, hexToBytes, keccak256 } from 'viem';
import { describe, expect, it } from 'vitest';
import vectors from '../../sdk/test/vectors/head-chain.json' with { type: 'json' };
import { nextHead, ZERO_HEAD } from '../src/head.ts';
import { verifyBundle } from '../src/verify.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const registry = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const key = new Uint8Array(32).fill(7);
const firstId: Hex = `0x${'33'.repeat(16)}`;
const base = { wsId, author: { memberId: firstId, name: 'Dina' }, ts: 100 };
const ops = [
  createOp({
    ...base,
    opId: firstId,
    type: 'issue.create',
    body: { title: 'Exit', description: '' },
  }),
  createOp({ ...base, type: 'issue.setStatus', body: { issueId: firstId, status: 'done' } }),
  createOp({ ...base, type: 'comment.add', body: { issueId: firstId, text: 'Independent' } }),
];
const stepIds = ['format', 'envelopes', 'head', 'anchored', 'complete', 'decrypt'];

// The SDK creates the artifacts, but the independent implementation computes their chain state.
function fixture(envelopes = ops.map((op) => bytesToHex(sealOp(op, key)))) {
  const bundle = createBundle({
    chainId: 420420777,
    registry,
    wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes,
    checkpoint: { blockNumber: 102 },
  });
  const events = new Map<bigint, AppendedEvent>();
  let head = ZERO_HEAD;
  envelopes.forEach((envelope, index) => {
    const digest = keccak256(envelope);
    head = nextHead(wsId, BigInt(index), head, digest);
    events.set(BigInt(index), {
      wsId,
      index: BigInt(index),
      author: owner,
      epoch: 0,
      digest,
      head,
      blockNumber: 100n + BigInt(index),
      txHash: wsId,
    });
  });
  const workspace: WorkspaceOnChain = {
    owner,
    epoch: 0,
    count: BigInt(envelopes.length),
    head,
    schemaId: JOURNAL_SCHEMA_ID,
  };
  const chain: ChainReader = {
    chainId: 420420777,
    registry,
    async getWorkspace(id) {
      return id === wsId ? workspace : null;
    },
    async getAppended(id, index) {
      return id === wsId ? (events.get(index) ?? null) : null;
    },
  };
  return { bundle, chain, workspace, events };
}

async function agree(bundle: unknown, chain: ChainReader, failed?: string, suppliedKey = key) {
  const independent = await verifyBundle({ bundle, chain, key: suppliedKey });
  const sdk = await sdkVerify({ bundle, chain, key: suppliedKey });
  expect(independent.ok).toBe(sdk.ok);
  expect(independent.steps.map((step) => step.id)).toEqual(stepIds);
  expect(independent.steps.find((step) => step.status === 'fail')?.id).toBe(failed);
  expect(sdk.steps.find((step) => step.status === 'fail')?.id).toBe(failed);
  const failureIndex = failed ? stepIds.indexOf(failed) : stepIds.length;
  expect(independent.steps.map((step) => step.status)).toEqual(
    stepIds.map((_, i) =>
      i < failureIndex ? 'pass' : i === failureIndex ? 'fail' : 'not checked',
    ),
  );
  return independent;
}

describe('independent head formula', () => {
  it.each(vectors.cases)('$name matches every shared protocol vector', (vector) => {
    let head = vector.startHead as Hex;
    for (const [offset, digest] of vector.digests.entries()) {
      head = nextHead(vector.wsId as Hex, BigInt(vector.startIndex + offset), head, digest as Hex);
      expect(head).toBe(vector.heads[offset]);
    }
  });
});

describe('cross-implementation verification', () => {
  it('agrees on a complete SDK bundle and all three journal operation types', async () => {
    const { bundle, chain } = fixture();
    const report = await agree(JSON.stringify(bundle), chain);
    expect(report.ok).toBe(true);
    expect(report.steps.every((step) => step.message.length > 15)).toBe(true);
  });

  it.each(['omitted', 'removed', 'altered', 'reordered', 'replacement', 'stale', 'wrong-key'])(
    'agrees on %s history',
    async (kind) => {
      const { bundle, chain } = fixture();
      let failed = 'head';
      let suppliedKey = key;
      if (kind === 'omitted') {
        bundle.envelopes.pop();
        failed = 'format';
      }
      if (kind === 'removed') {
        bundle.envelopes.splice(1, 1);
        bundle.checkpoint.count--;
      }
      if (kind === 'altered') {
        const bytes = hexToBytes(bundle.envelopes[1]);
        bytes[25] ^= 1;
        bundle.envelopes[1] = bytesToHex(bytes);
      }
      if (kind === 'reordered' || kind === 'replacement') {
        [bundle.envelopes[0], bundle.envelopes[1]] = [bundle.envelopes[1], bundle.envelopes[0]];
        if (kind === 'replacement') {
          bundle.checkpoint.head = fixture(bundle.envelopes).bundle.checkpoint.head;
          failed = 'anchored';
        }
      }
      if (kind === 'stale') {
        const older = fixture(bundle.envelopes.slice(0, 1)).bundle;
        await agree(older, chain, 'complete');
        return;
      }
      if (kind === 'wrong-key') {
        suppliedKey = new Uint8Array(32).fill(8);
        failed = 'decrypt';
      }
      await agree(bundle, chain, failed, suppliedKey);
    },
  );

  it.each(['version', 'short'])('rejects %s envelopes before RPC reads', async (kind) => {
    const { bundle, chain } = fixture();
    bundle.envelopes[0] = kind === 'short' ? '0x01' : `0x02${bundle.envelopes[0].slice(4)}`;
    await agree(bundle, chain, 'envelopes');
  });

  it('skips decryption explicitly without a key', async () => {
    const { bundle, chain } = fixture();
    const report = await verifyBundle({ bundle, chain });
    expect(report.ok).toBe(true);
    expect(report.steps.map((step) => step.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'skipped',
    ]);
  });

  it.each([
    'chainId',
    'registry',
    'schemaId',
    'event-head',
    'event-digest',
    'missing-event',
    'event-workspace',
    'event-index',
  ])('rejects mismatched %s', async (field) => {
    const { bundle, chain, workspace, events } = fixture();
    if (field === 'chainId') bundle.chainId = 1;
    if (field === 'registry') bundle.registry = owner;
    if (field === 'schemaId') workspace.schemaId = ZERO_HEAD;
    const event = events.get(2n) as AppendedEvent;
    if (field === 'event-head') event.head = ZERO_HEAD;
    if (field === 'event-digest') event.digest = ZERO_HEAD;
    if (field === 'event-workspace') event.wsId = ZERO_HEAD;
    if (field === 'event-index') event.index = 1n;
    if (field === 'missing-event') events.delete(2n);
    await agree(bundle, chain, 'anchored');
  });

  it('reports RPC failures at the current step without checking later steps', async () => {
    const { bundle, chain } = fixture();
    chain.getWorkspace = async () => {
      throw new Error('RPC unavailable');
    };
    const report = await verifyBundle({ bundle, chain });
    expect(report.ok).toBe(false);
    expect(report.steps[3]).toMatchObject({
      status: 'fail',
      message: expect.stringMatching(/RPC unavailable/),
    });
    expect(report.steps[4].status).toBe('not checked');
  });
});

describe('spec gap characterizations using the SDK only as a black box', () => {
  it('accepts empty genesis history and rejects a nonzero empty on-chain head', async () => {
    const { bundle, chain, workspace } = fixture([]);
    await agree(bundle, chain);
    workspace.head = wsId;
    await agree(bundle, chain, 'anchored');
  });

  it('treats checkpoint blockNumber as metadata, not an event query bound', async () => {
    const { bundle, chain } = fixture();
    bundle.checkpoint.blockNumber = 0;
    await agree(bundle, chain);
  });

  it('defers a bundle ahead of current chain count to completeness', async () => {
    const { bundle } = fixture();
    await agree(bundle, fixture(bundle.envelopes.slice(0, 1)).chain, 'complete');
  });

  it.each(['bundle', 'checkpoint'])('rejects unknown %s fields', async (where) => {
    const { bundle, chain } = fixture();
    const input =
      where === 'bundle'
        ? { ...bundle, extra: true }
        : { ...bundle, checkpoint: { ...bundle.checkpoint, extra: true } };
    expect(() => parseBundle(input)).toThrow();
    await agree(input, chain, 'format');
  });

  it.each(['wsId', 'schemaId', 'head', 'envelope'])(
    'requires lowercase bundle %s hex',
    async (field) => {
      const { bundle, chain } = fixture();
      if (field === 'wsId') bundle.wsId = `0x${'AB'.repeat(32)}`;
      if (field === 'schemaId') bundle.schemaId = `0x${'AB'.repeat(32)}`;
      if (field === 'head') bundle.checkpoint.head = `0x${'AB'.repeat(32)}`;
      if (field === 'envelope')
        bundle.envelopes[0] = `0x${bundle.envelopes[0].slice(2).toUpperCase()}`;
      await agree(bundle, chain, 'format');
    },
  );

  it('allows uppercase address hex but compares registry addresses case-insensitively', async () => {
    const { bundle, chain } = fixture();
    bundle.registry = `0x${'AB'.repeat(20)}`;
    const reader = { ...chain, registry: `0x${'ab'.repeat(20)}` as Hex };
    await agree(bundle, reader);
  });

  it.each([
    ['chainId', 0],
    ['chainId', Number.MAX_SAFE_INTEGER + 1],
    ['count', -1],
    ['blockNumber', -1],
    ['blockNumber', Number.MAX_SAFE_INTEGER + 1],
  ] as const)('rejects out-of-range %s = %s', async (field, value) => {
    const { bundle, chain } = fixture();
    if (field === 'chainId') bundle.chainId = value;
    else bundle.checkpoint[field] = value;
    await agree(bundle, chain, 'format');
  });

  it.each([
    { ...ops[0], extra: true },
    { ...ops[0], opId: `0x${'AA'.repeat(16)}` },
    { ...ops[0], body: { title: '', description: '' } },
    { ...ops[0], body: { title: 'x'.repeat(201), description: '' } },
    { ...ops[0], body: { title: 'Exit', description: 'x'.repeat(5001) } },
    { ...ops[0], author: { ...base.author, name: 'x'.repeat(65) } },
    { ...ops[0], author: { ...base.author, name: '' } },
    { ...ops[0], ts: -1 },
    { ...ops[0], ts: Number.MAX_SAFE_INTEGER + 1 },
    { ...ops[1], body: { issueId: firstId, status: 'closed' } },
    { ...ops[2], body: { issueId: firstId, text: '' } },
    { ...ops[2], body: { issueId: firstId, text: 'x'.repeat(5001) } },
    { ...ops[0], wsId: ZERO_HEAD },
    { ...ops[0], type: 'issue.delete' },
  ])('rejects authenticated invalid journal plaintext %#', async (value) => {
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    if (value.wsId === wsId) expect(() => decodeOp(plaintext)).toThrow();
    const nonce = new Uint8Array(24).fill(3);
    const ciphertext = xchacha20poly1305(key, nonce, hexToBytes(wsId)).encrypt(plaintext);
    const { bundle, chain } = fixture([
      bytesToHex(concat([new Uint8Array([1]), nonce, ciphertext])),
    ]);
    await agree(bundle, chain, 'decrypt');
  });

  it('accepts authenticated noncanonical JSON ordering and whitespace on read', async () => {
    const nonce = new Uint8Array(24).fill(3);
    const plaintext = new TextEncoder().encode(JSON.stringify(ops[0], null, 2));
    expect(decodeOp(plaintext)).toEqual(ops[0]);
    const ciphertext = xchacha20poly1305(key, nonce, hexToBytes(wsId)).encrypt(plaintext);
    const { bundle, chain } = fixture([
      bytesToHex(concat([new Uint8Array([1]), nonce, ciphertext])),
    ]);
    await agree(bundle, chain);
  });
});
