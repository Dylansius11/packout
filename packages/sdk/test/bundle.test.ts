import { bytesToHex, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  BUNDLE_FORMAT,
  chainHeads,
  createBundle,
  createOp,
  envelopeDigest,
  JOURNAL_SCHEMA_ID,
  PackoutError,
  parseBundle,
  sealOp,
  serializeBundle,
  ZERO_HEAD,
} from '../src/index.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const registry = '0x1111111111111111111111111111111111111111';
const key = new Uint8Array(32).fill(7);
const encrypted = sealOp(
  createOp({
    wsId,
    author: { memberId: `0x${'22'.repeat(16)}`, name: 'Dina' },
    type: 'issue.create',
    body: { title: 'Keep the history', description: '' },
  }),
  key,
);
const input = {
  chainId: 420420777,
  registry,
  wsId,
  schemaId: JOURNAL_SCHEMA_ID,
  envelopes: [bytesToHex(encrypted)],
  checkpoint: { blockNumber: 123456 },
} as const;

// Bundle arrays are mutable in the public format, so each fixture owns its array.
const bundleInput = () => ({ ...input, envelopes: [...input.envelopes] });

describe('bundle v1', () => {
  it('exports a complete checkpoint and round-trips encrypted history without a key', () => {
    const bundle = createBundle(bundleInput());
    expect(bundle.format).toBe(BUNDLE_FORMAT);
    expect(bundle.checkpoint).toEqual({
      count: 1,
      head: chainHeads(wsId, 0n, ZERO_HEAD, [envelopeDigest(encrypted)])[0],
      blockNumber: 123456,
    });
    const json = serializeBundle(bundle);
    expect(json).toContain('\n  "');
    expect(parseBundle(json)).toEqual(bundle);
    expect(parseBundle(JSON.parse(json))).toEqual(bundle);
    expect(Object.keys(bundle).sort()).toEqual([
      'chainId',
      'checkpoint',
      'envelopes',
      'format',
      'registry',
      'schemaId',
      'wsId',
    ]);
    expect(json).not.toContain('Keep the history');
  });

  it('serializes with stable key order regardless of input insertion order', () => {
    const bundle = createBundle(bundleInput());
    const reversed = {
      checkpoint: { head: bundle.checkpoint.head, blockNumber: 123456, count: 1 },
      envelopes: bundle.envelopes,
      schemaId: bundle.schemaId,
      wsId,
      registry: bundle.registry,
      chainId: bundle.chainId,
      format: bundle.format,
    };
    expect(serializeBundle(reversed)).toBe(serializeBundle(bundle));
  });

  it('exports empty history with count zero and the genesis head', () => {
    expect(createBundle({ ...bundleInput(), envelopes: [] }).checkpoint).toEqual({
      count: 0,
      head: ZERO_HEAD,
      blockNumber: 123456,
    });
  });

  it.each([
    ['format', { format: 'packout.bundle/2' }],
    ['chainId', { chainId: -1 }],
    ['registry', { registry: '0x1234' }],
    ['wsId', { wsId: '0x1234' }],
    ['schemaId', { schemaId: '0x1234' }],
    ['envelopes.0', { envelopes: ['0x0'] }],
    ['envelopes.0', { envelopes: ['0xzz'] }],
    ['checkpoint.count', { checkpoint: { head: ZERO_HEAD, blockNumber: 0 } }],
    ['checkpoint.count', { checkpoint: { count: 2, head: ZERO_HEAD, blockNumber: 0 } }],
    ['checkpoint.head', { checkpoint: { count: 1, head: '0x11', blockNumber: 0 } }],
    ['checkpoint.blockNumber', { checkpoint: { count: 1, head: ZERO_HEAD, blockNumber: 0.5 } }],
  ])('names the first invalid field %s', (path, override) => {
    expect(() => parseBundle({ ...createBundle(bundleInput()), ...override })).toThrow(
      expect.objectContaining({ code: 'invalid-bundle', message: expect.stringContaining(path) }),
    );
  });

  it.each(['{', null, [], undefined])(
    'rejects malformed bundle input %# with a specific error',
    (value) => {
      expect(() => parseBundle(value)).toThrow(PackoutError);
      expect(() => parseBundle(value)).toThrow(expect.objectContaining({ code: 'invalid-bundle' }));
    },
  );

  it('validates exports instead of creating files that cannot be imported', () => {
    expect(() => createBundle({ ...bundleInput(), checkpoint: { blockNumber: -1 } })).toThrow(
      expect.objectContaining({ code: 'invalid-bundle' }),
    );
  });
});
