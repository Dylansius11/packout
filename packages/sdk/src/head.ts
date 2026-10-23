import { encodeAbiParameters, type Hex, keccak256, stringToHex } from 'viem';

export const HEAD_DOMAIN: Hex = keccak256(stringToHex('packout.head.v1'));
export const ZERO_HEAD: Hex = `0x${'00'.repeat(32)}`;

export function nextHead(wsId: Hex, index: bigint, prevHead: Hex, digest: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint64' },
        { type: 'bytes32' },
        { type: 'bytes32' },
      ],
      [HEAD_DOMAIN, wsId, index, prevHead, digest],
    ),
  );
}

export function chainHeads(
  wsId: Hex,
  startIndex: bigint,
  startHead: Hex,
  digests: readonly Hex[],
): Hex[] {
  let head = startHead;
  return digests.map((digest, offset) => {
    head = nextHead(wsId, startIndex + BigInt(offset), head, digest);
    return head;
  });
}
