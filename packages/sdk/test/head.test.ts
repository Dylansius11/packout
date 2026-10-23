import type { Address, Hex } from 'viem';
import { keccak256, stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  chainHeads,
  HEAD_DOMAIN,
  JOURNAL_SCHEMA,
  JOURNAL_SCHEMA_ID,
  nextHead,
  workspaceId,
  ZERO_HEAD,
} from '../src/index.ts';
import vectors from './vectors/head-chain.json' with { type: 'json' };

describe('head chain protocol', () => {
  it('uses the shared domain and zero genesis head', () => {
    expect(HEAD_DOMAIN).toBe(vectors.headDomain);
    expect(ZERO_HEAD).toBe(`0x${'00'.repeat(32)}`);
  });

  it.each(vectors.cases)('reproduces $name byte for byte', (vector) => {
    const wsId = vector.wsId as Hex;
    const startHead = vector.startHead as Hex;
    const digests = vector.digests as Hex[];
    expect(chainHeads(wsId, BigInt(vector.startIndex), startHead, digests)).toEqual(vector.heads);
    let head = startHead;
    for (const [offset, digest] of digests.entries()) {
      head = nextHead(wsId, BigInt(vector.startIndex + offset), head, digest);
      expect(head).toBe(vector.heads[offset]);
    }
  });

  it('leaves an empty continuation empty', () => {
    expect(chainHeads(ZERO_HEAD, 0n, ZERO_HEAD, [])).toEqual([]);
  });

  it.each([-1n, 1n << 64n])('rejects an index outside uint64: %s', (index) => {
    expect(() => nextHead(ZERO_HEAD, index, ZERO_HEAD, ZERO_HEAD)).toThrow();
  });
});

describe('workspace identity', () => {
  it.each(vectors.workspaceIds)('derives the shared workspace id', (vector) => {
    expect(workspaceId(vector.owner as Address, vector.salt as Hex)).toBe(vector.wsId);
  });

  it('identifies the journal schema by its UTF-8 keccak hash', () => {
    expect(JOURNAL_SCHEMA).toBe('packout.journal/1');
    expect(JOURNAL_SCHEMA_ID).toBe(keccak256(stringToHex('packout.journal/1')));
  });
});
