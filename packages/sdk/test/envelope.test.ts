import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes } from '@noble/ciphers/utils.js';
import { type Hex, hexToBytes, keccak256 } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  createOp,
  ENVELOPE_VERSION,
  encodeOp,
  envelopeDigest,
  generateWorkspaceKey,
  openEnvelope,
  sealOp,
} from '../src/index.ts';

const wsA: Hex = `0x${'11'.repeat(32)}`;
const wsB: Hex = `0x${'22'.repeat(32)}`;
const key = new Uint8Array(32).fill(7);
const op = createOp({
  wsId: wsA,
  opId: `0x${'33'.repeat(16)}`,
  ts: 1761200000000,
  author: { memberId: `0x${'44'.repeat(16)}`, name: 'Dina' },
  type: 'issue.create',
  body: { title: 'Leave the vendor', description: 'Keep the history: é' },
});

describe('workspace envelopes', () => {
  it('generates independent 32-byte workspace keys', () => {
    const first = generateWorkspaceKey();
    const second = generateWorkspaceKey();
    expect(first).toBeInstanceOf(Uint8Array);
    expect(first).toHaveLength(32);
    expect(second).toHaveLength(32);
    expect(first).not.toEqual(second);
    expect(openEnvelope(sealOp(op, first), first, wsA)).toEqual(op);
  });

  it('seals and opens the exact op without mutating caller buffers', () => {
    const envelope = sealOp(op, key);
    const before = envelope.slice();
    expect(openEnvelope(envelope, key, wsA)).toEqual(op);
    expect(envelope).toEqual(before);
    expect(key).toEqual(new Uint8Array(32).fill(7));
  });

  it('uses version 1, a fresh 24-byte nonce, and a 16-byte authentication tag', () => {
    const first = sealOp(op, key);
    const second = sealOp(op, key);
    expect(ENVELOPE_VERSION).toBe(1);
    expect(first[0]).toBe(1);
    expect(first).toHaveLength(1 + 24 + encodeOp(op).length + 16);
    expect(first.subarray(1, 25)).not.toEqual(second.subarray(1, 25));
    expect(first).not.toEqual(second);
    expect(openEnvelope(first, key, wsA)).toEqual(op);
    expect(openEnvelope(second, key, wsA)).toEqual(op);
    expect(
      xchacha20poly1305(key, first.subarray(1, 25), hexToBytes(wsA)).decrypt(first.subarray(25)),
    ).toEqual(encodeOp(op));
  });

  it('rejects the wrong key with decrypt-failed', () => {
    const envelope = sealOp(op, key);
    expect(() => openEnvelope(envelope, new Uint8Array(32).fill(8), wsA)).toThrow(
      expect.objectContaining({ code: 'decrypt-failed' }),
    );
  });

  it('authenticates the workspace id as raw bytes', () => {
    expect(() => openEnvelope(sealOp(op, key), key, wsB)).toThrow(
      expect.objectContaining({ code: 'decrypt-failed' }),
    );
  });

  it.each([1, 25, -1])('rejects a changed nonce, ciphertext or tag byte at %s', (offset) => {
    const envelope = sealOp(op, key);
    const index = offset < 0 ? envelope.length + offset : offset;
    envelope[index] ^= 1;
    expect(() => openEnvelope(envelope, key, wsA)).toThrow(
      expect.objectContaining({ code: 'decrypt-failed' }),
    );
  });

  it.each([0, 2, 255])('rejects unsupported envelope version %s', (version) => {
    const envelope = sealOp(op, key);
    envelope[0] = version;
    expect(() => openEnvelope(envelope, key, wsA)).toThrow(
      expect.objectContaining({ code: 'malformed-envelope' }),
    );
  });

  it.each([0, 1, 24, 25, 40])('rejects a truncated envelope of length %s', (length) => {
    expect(() => openEnvelope(sealOp(op, key).subarray(0, length), key, wsA)).toThrow(
      expect.objectContaining({ code: 'malformed-envelope' }),
    );
  });

  it.each([0, 16, 31, 33])('rejects a %s-byte key before crypto', (length) => {
    const invalid = new Uint8Array(length);
    expect(() => sealOp(op, invalid)).toThrow(RangeError);
    expect(() => openEnvelope(sealOp(op, key), invalid, wsA)).toThrow(RangeError);
  });

  it('rejects an authenticated plaintext whose wsId differs from its AAD', () => {
    const nonce = new Uint8Array(24).fill(3);
    const ciphertext = xchacha20poly1305(key, nonce, hexToBytes(wsB)).encrypt(encodeOp(op));
    const envelope = concatBytes(new Uint8Array([1]), nonce, ciphertext);
    expect(() => openEnvelope(envelope, key, wsB)).toThrow(
      expect.objectContaining({ code: 'workspace-mismatch' }),
    );
  });

  it.each([
    [{ ...op, type: 'issue.delete' }, 'unknown-op-type'],
    [{ ...op, body: { title: '', description: '' } }, 'invalid-op'],
  ])('preserves schema errors after successful authentication %#', (value, code) => {
    const nonce = new Uint8Array(24).fill(3);
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = xchacha20poly1305(key, nonce, hexToBytes(wsA)).encrypt(plaintext);
    const envelope = concatBytes(new Uint8Array([1]), nonce, ciphertext);
    expect(() => openEnvelope(envelope, key, wsA)).toThrow(expect.objectContaining({ code }));
  });

  it('hashes every envelope byte including the version and nonce', () => {
    const envelope = sealOp(op, key);
    expect(envelopeDigest(envelope)).toBe(keccak256(envelope));
    expect(envelopeDigest(new Uint8Array())).toBe(
      '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
    const changed = envelope.slice();
    changed[1] ^= 1;
    expect(envelopeDigest(changed)).not.toBe(envelopeDigest(envelope));
  });
});
