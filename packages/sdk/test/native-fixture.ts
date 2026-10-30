// Synthetic node transports with one Appended payload observed in testnet block 248295.

import type { ApiPromise } from '@polkadot/api';
import type {} from '@polkadot/api/augment';
import {
  type Address,
  createPublicClient,
  custom,
  defineChain,
  encodeAbiParameters,
  type Hex,
  type PublicClient,
  toFunctionSelector,
  toHex,
} from 'viem';
import type { RegistryReader, RegistryReaderOptions } from '../src/chain/reader.ts';
import type { AppendedEvent } from '../src/chain-reader.ts';

const registry: Address = '0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0';
const wsId: Hex = '0xb74ce764f52242e4c97c2bcb179777324a02883826fb436c14e3680c098ee48f';
const otherWsId: Hex = `0x${'ab'.repeat(32)}`;
const genesis: Hex = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
const topic: Hex = '0xf8c557326949317cd7769ba05fb911f13c76dbcb6883b4a38bee487cb1c31b47';
const blockHash: Hex = `0x${'cd'.repeat(32)}`;
const nextHash: Hex = `0x${'ef'.repeat(32)}`;
const extrinsicHash: Hex = '0x1a62aea703389efb9248dd2a41c2c329df6c58fc88a8d70fe547527dc76cb21f';
const evmTxHash: Hex = `0x${'aa'.repeat(32)}`;
const nativeEvent: AppendedEvent = {
  wsId,
  index: 1n,
  author: '0x2d313fc3e31a90b4a23f0e4b15a7c37817d70dd1',
  epoch: 0,
  digest: '0x92702755c70f29e4241a74acde9f2e6f8e9b9ee530ced34dfede4feceeb53238',
  head: '0xfe7a9c7db419f40f8b07a7ae55e6f56e5fba9ddb4fdc60536369f1d527e2e357',
  blockNumber: 248295n,
  txHash: extrinsicHash,
};
const wordTypes = [{ type: 'uint32' }, { type: 'bytes32' }, { type: 'bytes32' }] as const;
const hexCodec = (value: string) => ({ toHex: () => value, toString: () => value });
const numberCodec = (value: bigint) => ({
  toBigInt: () => value,
  toNumber: () => Number(value),
  toString: () => String(value),
});
const upper = (value: Hex): Hex => `0x${value.slice(2).toUpperCase()}`;

function wire(event: AppendedEvent = nativeEvent) {
  return {
    data: encodeAbiParameters(wordTypes, [event.epoch, event.digest, event.head]),
    topics: [
      topic,
      event.wsId,
      toHex(event.index, { size: 32 }),
      `0x${event.author.slice(2).padStart(64, '0')}` as Hex,
    ],
  };
}

type HexCodec = { toHex(): string; toString(): string };
type RecordFixture = {
  phase: {
    isApplyExtrinsic: boolean;
    asApplyExtrinsic: { toBigInt(): bigint; toNumber(): number; toString(): string };
  };
  event: { section: string; method: string; data: (HexCodec | HexCodec[])[] };
};

function record(event: AppendedEvent = nativeEvent): RecordFixture {
  const encoded = wire(event);
  return {
    phase: { isApplyExtrinsic: true, asApplyExtrinsic: numberCodec(0n) },
    event: {
      section: 'revive',
      method: 'ContractEmitted',
      data: [hexCodec(registry), hexCodec(encoded.data), encoded.topics.map(hexCodec)],
    },
  };
}
type NativeBlock = { height: bigint; events: RecordFixture[]; extrinsics: Hex[] };

export function fixture(
  makeReader: (
    options: RegistryReaderOptions & {
      nativeApi: ApiPromise;
      blockHashes: readonly string[];
    },
  ) => Promise<RegistryReader>,
) {
  const nativeBlock: NativeBlock = {
    height: 248295n,
    events: [record()],
    extrinsics: [extrinsicHash],
  };
  const state = {
    chainId: 420420777,
    genesis,
    evmHeight: 248300n,
    finalizedHeight: 248300n,
    evm: [] as AppendedEvent[],
    blocks: new Map<Hex, NativeBlock>([[blockHash, nativeBlock]]),
    canonical: new Map<bigint, Hex>([
      [248295n, blockHash],
      [248296n, nextHash],
    ]),
    unreadable: false,
  };
  const finalizedHash: Hex = `0x${'ff'.repeat(32)}`;
  const nativeApi = {
    get genesisHash() {
      return hexCodec(state.genesis);
    },
    rpc: {
      chain: {
        getFinalizedHead: async () => hexCodec(finalizedHash),
        getHeader: async (hash: string) => {
          if (hash === finalizedHash) return { number: numberCodec(state.finalizedHeight) };
          const block = state.blocks.get(hash.toLowerCase() as Hex);
          if (!block) throw new Error('Unknown native block');
          return { number: numberCodec(block.height) };
        },
        getBlockHash: async (height: bigint | number) => {
          if (BigInt(height) === 0n) return hexCodec(state.genesis);
          const hash = state.canonical.get(BigInt(height));
          if (!hash) throw new Error('Unknown native height');
          return hexCodec(hash);
        },
        getBlock: async (hash: string) => {
          if (state.unreadable) throw new Error('Native block body is unavailable');
          const block = state.blocks.get(hash.toLowerCase() as Hex);
          if (!block) throw new Error('Unknown native block');
          return {
            block: {
              header: { number: numberCodec(block.height) },
              extrinsics: block.extrinsics.map((value) => ({ hash: hexCodec(value) })),
            },
          };
        },
      },
    },
    at: async (hash: string) => ({
      query: {
        system: {
          events: async () => {
            const block = state.blocks.get(hash.toLowerCase() as Hex);
            if (!block) throw new Error('Unknown native events');
            return block.events;
          },
        },
      },
    }),
  } as unknown as ApiPromise;
  const client = createPublicClient({
    chain: defineChain({
      id: 420420777,
      name: 'Portaldot',
      nativeCurrency: { name: 'Test POT', symbol: 'tPOT', decimals: 18 },
      rpcUrls: { default: { http: ['http://rpc.invalid'] } },
    }),
    transport: custom({
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return toHex(state.chainId);
        if (method === 'eth_blockNumber') return toHex(state.evmHeight);
        if (method === 'eth_getLogs') {
          const [filter] = params as [{ fromBlock: Hex; toBlock: Hex; topics: (Hex | null)[] }];
          return state.evm
            .filter((event) => {
              const topics = wire(event).topics;
              return (
                event.blockNumber >= BigInt(filter.fromBlock) &&
                event.blockNumber <= BigInt(filter.toBlock) &&
                filter.topics.every(
                  (value, index) =>
                    value === null || value.toLowerCase() === topics[index]?.toLowerCase(),
                )
              );
            })
            .map((event, index) => ({
              ...wire(event),
              address: registry,
              blockNumber: toHex(event.blockNumber),
              blockHash: `0x${'12'.repeat(32)}`,
              transactionHash: event.txHash,
              transactionIndex: '0x0',
              logIndex: toHex(index),
              removed: false,
            }));
        }
        if (method === 'eth_call') {
          const [call] = params as [{ data: Hex }];
          // canWrite(bytes32,address), otherwise getWorkspace(bytes32).
          if (call.data.startsWith(toFunctionSelector('canWrite(bytes32,address)'))) {
            return encodeAbiParameters([{ type: 'bool' }], [true]);
          }
          return encodeAbiParameters(
            [
              { type: 'address' },
              { type: 'uint32' },
              { type: 'uint64' },
              { type: 'bytes32' },
              { type: 'bytes32' },
            ],
            [nativeEvent.author, 0, 2n, nativeEvent.head, otherWsId],
          );
        }
        throw new Error(`Unexpected EVM RPC ${method}`);
      },
    }),
  }) as PublicClient;
  const blockHashes: Hex[] = [blockHash];
  const create = (fromBlock?: bigint) =>
    makeReader({ client, registry, nativeApi, blockHashes, fromBlock });
  return { state, nativeApi, nativeBlock, client, blockHashes, create };
}

export {
  blockHash,
  evmTxHash,
  extrinsicHash,
  hexCodec,
  nativeEvent,
  nextHash,
  numberCodec,
  otherWsId,
  record,
  topic,
  upper,
  wsId,
};
