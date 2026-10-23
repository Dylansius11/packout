import { type Address, encodeAbiParameters, type Hex, keccak256, stringToHex } from 'viem';

export const JOURNAL_SCHEMA = 'packout.journal/1';
export const JOURNAL_SCHEMA_ID: Hex = keccak256(stringToHex(JOURNAL_SCHEMA));

export function workspaceId(owner: Address, salt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [owner, salt]));
}
