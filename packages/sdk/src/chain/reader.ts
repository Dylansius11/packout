import { type Address, getAbiItem, type Hex, type PublicClient } from 'viem';
import type { AppendedEvent, ChainReader } from '../chain-reader.ts';
import { packoutRegistryAbi } from './abi.ts';
import { RegistryError, registryFailure } from './errors.ts';

export interface RegistryReader extends ChainReader {
  canWrite(wsId: Hex, account: Address): Promise<boolean>;
  getAppendedRange(wsId: Hex, fromIndex: bigint, toIndex: bigint): Promise<AppendedEvent[]>;
}

export interface RegistryReaderOptions {
  client: PublicClient;
  registry: Address;
  fromBlock?: bigint;
}

const appended = getAbiItem({ abi: packoutRegistryAbi, name: 'Appended' });
const LOG_CAP = 10_000;

export function createRegistryReader({
  client,
  registry,
  fromBlock = 0n,
}: RegistryReaderOptions): RegistryReader {
  if (!client.chain)
    throw new Error('Registry reads require a PublicClient with a configured chain.');

  async function events(
    wsId: Hex,
    start: bigint,
    end: bigint,
    index?: bigint,
  ): Promise<AppendedEvent[]> {
    if (start > end) return [];
    const logs = await client.getLogs({
      address: registry,
      event: appended,
      args: { wsId, index },
      fromBlock: start,
      toBlock: end,
      strict: true,
    });
    if (logs.length >= LOG_CAP) {
      if (start === end) {
        throw new Error(
          `Cannot read complete history: a single block (${start}) returned 10,000 logs.`,
        );
      }
      const middle = start + (end - start) / 2n;
      const left = await events(wsId, start, middle, index);
      const right = await events(wsId, middle + 1n, end, index);
      return left.concat(right);
    }
    return logs.map((log) => {
      if (log.blockNumber === null || log.transactionHash === null) {
        throw new Error('An Appended event is missing its mined block or transaction hash.');
      }
      return { ...log.args, blockNumber: log.blockNumber, txHash: log.transactionHash };
    });
  }

  return {
    chainId: client.chain.id,
    registry,
    async getWorkspace(wsId) {
      try {
        const [owner, epoch, count, head, schemaId] = await client.readContract({
          abi: packoutRegistryAbi,
          address: registry,
          functionName: 'getWorkspace',
          args: [wsId],
        });
        return { owner, epoch, count, head, schemaId };
      } catch (cause) {
        const error = registryFailure(cause);
        if (error instanceof RegistryError && error.reason === 'UnknownWorkspace') return null;
        throw error;
      }
    },
    async canWrite(wsId, account) {
      try {
        return await client.readContract({
          abi: packoutRegistryAbi,
          address: registry,
          functionName: 'canWrite',
          args: [wsId, account],
        });
      } catch (error) {
        throw registryFailure(error);
      }
    },
    async getAppended(wsId, index) {
      const end = await client.getBlockNumber({ cacheTime: 0 });
      const logs = await events(wsId, fromBlock, end, index);
      return logs[0] ?? null;
    },
    async getAppendedRange(wsId, fromIndex, toIndex) {
      if (fromIndex > toIndex) return [];
      const end = await client.getBlockNumber({ cacheTime: 0 });
      const logs = await events(wsId, fromBlock, end);
      return logs
        .filter((log) => log.index >= fromIndex && log.index <= toIndex)
        .sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
    },
  };
}
