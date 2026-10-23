import type { Address, Hex } from 'viem';

export type WorkspaceOnChain = {
  owner: Address;
  epoch: number;
  count: bigint;
  head: Hex;
  schemaId: Hex;
};

export type AppendedEvent = {
  wsId: Hex;
  index: bigint;
  author: Address;
  epoch: number;
  digest: Hex;
  head: Hex;
  blockNumber: bigint;
  txHash: Hex;
};

export interface ChainReader {
  readonly chainId: number;
  readonly registry: Address;
  getWorkspace(wsId: Hex): Promise<WorkspaceOnChain | null>;
  getAppended(wsId: Hex, index: bigint): Promise<AppendedEvent | null>;
}
