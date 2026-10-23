import {
  type AppendedEvent,
  packoutRegistryAbi,
  type RegistryReader,
  type WorkspaceOnChain,
} from '@packout/sdk';
import {
  type Address,
  decodeEventLog,
  getAbiItem,
  type Hex,
  hexToBigInt,
  hexToNumber,
  type PublicClient,
  type RpcLog,
  toEventSelector,
} from 'viem';
import { type AccessEvent, byPosition } from './history';

/** An RPC that returns this many rows may have silently truncated the answer (INTEGRATIONS.md 1.1). */
const LOG_CAP = 10_000;

const SELECTORS = (
  ['WorkspaceCreated', 'WriterGranted', 'WriterRevoked', 'EpochRotated', 'Appended'] as const
).map((name) => toEventSelector(getAbiItem({ abi: packoutRegistryAbi, name })));

export type ProofData = {
  workspace: WorkspaceOnChain;
  /** Oldest first. */
  appended: AppendedEvent[];
  /** Oldest first. */
  access: AccessEvent[];
  latestBlock: bigint;
};

export type ProofSource = {
  client: PublicClient;
  reader: RegistryReader;
  address: Address;
  fromBlock: bigint;
};

/** Every registry event for one workspace in [start, end]; a full answer is bisected until it fits. */
async function workspaceLogs(
  client: PublicClient,
  address: Address,
  wsId: Hex,
  start: bigint,
  end: bigint,
): Promise<RpcLog[]> {
  if (start > end) return [];
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [
      {
        address,
        fromBlock: `0x${start.toString(16)}`,
        toBlock: `0x${end.toString(16)}`,
        topics: [SELECTORS, wsId],
      },
    ],
  });
  if (logs.length < LOG_CAP) return logs;
  if (start === end) {
    throw new Error(
      `Cannot read the complete history: block ${start} alone returned ${LOG_CAP} logs.`,
    );
  }
  const middle = start + (end - start) / 2n;
  return [
    ...(await workspaceLogs(client, address, wsId, start, middle)),
    ...(await workspaceLogs(client, address, wsId, middle + 1n, end)),
  ];
}

function decode(log: RpcLog): { appended?: AppendedEvent; access?: AccessEvent } {
  if (log.blockNumber === null || log.logIndex === null || log.transactionHash === null) {
    throw new Error('Portaldot returned an event that has no block, position or transaction.');
  }
  const position = {
    blockNumber: hexToBigInt(log.blockNumber),
    logIndex: hexToNumber(log.logIndex),
    txHash: log.transactionHash,
  };
  const event = decodeEventLog({
    abi: packoutRegistryAbi,
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]],
    strict: true,
  });
  switch (event.eventName) {
    case 'Appended':
      return { appended: { ...event.args, ...position } };
    case 'WorkspaceCreated':
      return {
        access: {
          ...position,
          kind: 'created',
          owner: event.args.owner,
          schemaId: event.args.schemaId,
        },
      };
    case 'WriterGranted':
      return {
        access: {
          ...position,
          kind: 'granted',
          epoch: event.args.epoch,
          writer: event.args.writer,
        },
      };
    case 'WriterRevoked':
      return {
        access: {
          ...position,
          kind: 'revoked',
          epoch: event.args.epoch,
          writer: event.args.writer,
        },
      };
    case 'EpochRotated':
      return {
        access: {
          ...position,
          kind: 'rotated',
          epoch: event.args.epoch,
          writers: event.args.writers,
        },
      };
    default:
      return {};
  }
}

/** What Portaldot says about one workspace, read from the deployment block to the latest block. null: no such workspace. */
export async function loadProof(
  { client, reader, address, fromBlock }: ProofSource,
  wsId: Hex,
): Promise<ProofData | null> {
  const latestBlock = await client.getBlockNumber({ cacheTime: 0 });
  const workspace = await reader.getWorkspace(wsId);
  if (!workspace) return null;
  const logs = await workspaceLogs(client, address, wsId, fromBlock, latestBlock);
  const appended: AppendedEvent[] = [];
  const access: AccessEvent[] = [];
  for (const log of logs) {
    const decoded = decode(log);
    if (decoded.appended) appended.push(decoded.appended);
    if (decoded.access) access.push(decoded.access);
  }
  appended.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
  access.sort(byPosition);
  return { workspace, appended, access, latestBlock };
}
