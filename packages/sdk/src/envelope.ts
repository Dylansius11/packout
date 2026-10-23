import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { concatBytes, randomBytes } from '@noble/ciphers/utils.js';
import { type Hex, hexToBytes, keccak256 } from 'viem';
import { PackoutError } from './errors.ts';
import { decodeOp, encodeOp, type Op } from './op.ts';

export const ENVELOPE_VERSION = 0x01;

export function generateWorkspaceKey(): Uint8Array {
  return randomBytes(32);
}

export function sealOp(op: Op, key: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new RangeError('Workspace key must be 32 bytes.');
  const plaintext = encodeOp(op);
  const nonce = randomBytes(24);
  const ciphertext = xchacha20poly1305(key, nonce, hexToBytes(op.wsId)).encrypt(plaintext);
  return concatBytes(new Uint8Array([ENVELOPE_VERSION]), nonce, ciphertext);
}

export function openEnvelope(envelope: Uint8Array, key: Uint8Array, wsId: Hex): Op {
  if (key.length !== 32) throw new RangeError('Workspace key must be 32 bytes.');
  if (envelope.length < 1 + 24 + 16 || envelope[0] !== ENVELOPE_VERSION) {
    throw new PackoutError(
      'malformed-envelope',
      'Envelope is truncated or has an unsupported version.',
    );
  }
  let plaintext: Uint8Array;
  try {
    plaintext = xchacha20poly1305(key, envelope.subarray(1, 25), hexToBytes(wsId)).decrypt(
      envelope.subarray(25),
    );
  } catch (cause) {
    throw new PackoutError(
      'decrypt-failed',
      'Envelope authentication failed. Check the workspace key and workspace id.',
      { cause },
    );
  }
  const op = decodeOp(plaintext);
  if (op.wsId !== wsId) {
    throw new PackoutError(
      'workspace-mismatch',
      'Decrypted operation belongs to a different workspace.',
    );
  }
  return op;
}

export function envelopeDigest(envelope: Uint8Array): Hex {
  return keccak256(envelope);
}
