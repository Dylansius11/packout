import { createPublicClient, type Hex, http, parseAbi, parseAbiItem } from 'viem';
import type { Bundle } from './format.ts';

export const DEFAULT_RPC = 'https://test-evm-rpc-v3.portaldot.dev';
export interface Workspace {
  count: bigint;
  head: Hex;
  schemaId: Hex;
}
export interface Admission {
  wsId: Hex;
  index: bigint;
  head: Hex;
  digest: Hex;
}
export interface ChainReader {
  chainId: number;
  registry: Hex;
  getWorkspace(wsId: Hex): Promise<Workspace | null>;
  getAppended(wsId: Hex, index: bigint): Promise<Admission | null>;
}

// ABI transcribed from SMART-CONTRACT.md sections 4 and 5, not generated artifacts.
const abi = parseAbi([
  'function getWorkspace(bytes32 wsId) view returns (address owner, uint32 epoch, uint64 count, bytes32 head, bytes32 schemaId)',
]);
const appended = parseAbiItem(
  'event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head)',
);

export async function readChain(bundle: Bundle, rpc: string): Promise<ChainReader> {
  const client = createPublicClient({ transport: http(rpc, { timeout: 15_000, retryCount: 0 }) });
  const chainId = await client.getChainId();
  // Read current state and its events from one observed block, avoiding a moving-count race.
  const blockNumber = await client.getBlockNumber();
  return {
    chainId,
    registry: bundle.registry,
    async getWorkspace(wsId) {
      const [, , count, head, schemaId] = await client.readContract({
        address: bundle.registry,
        abi,
        functionName: 'getWorkspace',
        args: [wsId],
        blockNumber,
      });
      return { count, head, schemaId };
    },
    async getAppended(wsId, index) {
      const logs = await client.getLogs({
        address: bundle.registry,
        event: appended,
        args: { wsId, index },
        fromBlock: 0n,
        toBlock: blockNumber,
        strict: true,
      });
      // Ambiguous duplicate admissions are not proof of a unique anchored checkpoint.
      return logs.length === 1 ? logs[0].args : null;
    },
  };
}
