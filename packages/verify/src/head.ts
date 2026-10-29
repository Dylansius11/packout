import { encodeAbiParameters, type Hex, keccak256, stringToHex } from 'viem';

export const ZERO_HEAD: Hex = `0x${'00'.repeat(32)}`;
const HEAD_DOMAIN = keccak256(stringToHex('packout.head.v1'));

// SMART-CONTRACT.md section 3: standard ABI words, never packed encoding.
export function nextHead(wsId: Hex, index: bigint, previous: Hex, digest: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint64' },
        { type: 'bytes32' },
        { type: 'bytes32' },
      ],
      [HEAD_DOMAIN, wsId, index, previous, digest],
    ),
  );
}
