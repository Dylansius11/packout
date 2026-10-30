import { createPublicClient, type Hex, http, parseAbi, parseAbiItem } from 'viem';
import type { Bundle } from './format.ts';
import { type LocatedAdmission, type NativeOptions, readNativeAdmissions } from './native.ts';

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

export async function readChain(
  bundle: Bundle,
  rpc: string,
  native?: NativeOptions,
): Promise<ChainReader> {
  const client = createPublicClient({ transport: http(rpc, { timeout: 15_000, retryCount: 0 }) });
  const chainId = await client.getChainId();
  // Read current state and its events from one observed block, avoiding a moving-count race.
  const blockNumber = await client.getBlockNumber();
  let nativeAdmissions: LocatedAdmission[] = [];
  if (native) {
    if (chainId !== 420420777)
      throw new Error('Native event proofs require the Portaldot testnet EVM network.');
    if (!native.nativeApi)
      throw new Error('Native event proofs require an initialized native client.');
    nativeAdmissions = await readNativeAdmissions(
      native.nativeApi,
      bundle.registry,
      native.blockHashes,
      blockNumber,
    );
  }
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
      const admissions = nativeAdmissions.filter(
        (event) => event.wsId.toLowerCase() === wsId.toLowerCase() && event.index === index,
      );
      // Native first, EVM last: an identical same-block admission retains the EVM identifier.
      for (const log of logs) {
        if (
          log.blockNumber === null ||
          log.transactionHash === null ||
          log.blockNumber > blockNumber
        )
          throw new Error(
            'RPC admission is missing its mined identity or is ahead of the observed snapshot.',
          );
        admissions.push({ ...log.args, blockNumber: log.blockNumber, txHash: log.transactionHash });
      }
      let selected: LocatedAdmission | undefined;
      for (const admission of admissions) {
        if (
          selected &&
          (selected.blockNumber !== admission.blockNumber ||
            selected.author.toLowerCase() !== admission.author.toLowerCase() ||
            selected.epoch !== admission.epoch ||
            selected.digest.toLowerCase() !== admission.digest.toLowerCase() ||
            selected.head.toLowerCase() !== admission.head.toLowerCase())
        )
          throw new Error(
            'Ambiguous conflicting admissions exist for this workspace and operation index.',
          );
        selected = admission;
      }
      return selected ?? null;
    },
  };
}
