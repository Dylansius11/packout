import { combine, split } from 'shamir-secret-sharing';
import { hexToBytes, keccak256 } from 'viem';
import { z } from 'zod';
import { PackoutError } from './errors.ts';

const VERSION = 1;
const KEY_BYTES = 32;
const COMMITMENT_BYTES = 16;
const PAYLOAD_OFFSET = 1 + COMMITMENT_BYTES;
const SHARE_BYTES = PAYLOAD_OFFSET + KEY_BYTES + 1;
const keySchema = z.instanceof(Uint8Array).refine((key) => key.length === KEY_BYTES);
const sharesSchema = z
  .array(
    z
      .instanceof(Uint8Array)
      .refine(
        (share) =>
          share.length === SHARE_BYTES && share[0] === VERSION && share[SHARE_BYTES - 1] !== 0,
      ),
  )
  .min(2)
  .max(3);

function commitment(key: Uint8Array): Uint8Array {
  return hexToBytes(keccak256(key)).subarray(0, COMMITMENT_BYTES);
}

export async function splitWorkspaceKey(key: Uint8Array): Promise<Uint8Array[]> {
  if (!keySchema.safeParse(key).success) {
    throw new PackoutError(
      'invalid-workspace-key',
      'Workspace key must be exactly 32 bytes (Uint8Array).',
    );
  }
  const digest = commitment(key);
  const shares = await split(key, 3, 2);
  return shares.map((payload) => {
    const share = new Uint8Array(SHARE_BYTES);
    share[0] = VERSION;
    share.set(digest, 1);
    share.set(payload, PAYLOAD_OFFSET);
    return share;
  });
}

export async function combineWorkspaceKey(shares: Uint8Array[]): Promise<Uint8Array> {
  const first = Array.isArray(shares) ? shares[0] : undefined;
  if (!sharesSchema.safeParse(shares).success || !first) {
    throw new PackoutError(
      'invalid-key-shares',
      'Provide two or three complete PACKOUT v1 key shares with nonzero backup coordinates.',
    );
  }
  const digest = first.subarray(1, PAYLOAD_OFFSET);
  const coordinates = new Set<number>();
  for (const share of shares) {
    if (!digest.every((byte, index) => byte === share[index + 1])) {
      throw new PackoutError(
        'invalid-key-shares',
        'These shares belong to different workspace keys.',
      );
    }
    const coordinate = share[SHARE_BYTES - 1] ?? 0;
    if (coordinates.has(coordinate)) {
      throw new PackoutError('invalid-key-shares', 'Recovery requires distinct backup shares.');
    }
    coordinates.add(coordinate);
  }
  let key: Uint8Array;
  try {
    key = await combine(shares.map((share) => share.subarray(PAYLOAD_OFFSET)));
  } catch (cause) {
    throw new PackoutError('invalid-key-shares', 'The backup shares could not be combined.', {
      cause,
    });
  }
  if (!commitment(key).every((byte, index) => byte === digest[index])) {
    key.fill(0);
    throw new PackoutError(
      'invalid-key-shares',
      'Key recovery failed its integrity check. A backup share is damaged or from another split.',
    );
  }
  return key;
}
