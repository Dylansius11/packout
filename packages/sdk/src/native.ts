import '@polkadot/api/augment';
import type { ApiPromise } from '@polkadot/api';
import { decodeEventLog, type Hex } from 'viem';
import { z } from 'zod';
import { packoutRegistryAbi } from './chain/abi.ts';
import {
  createRegistryReader,
  type RegistryReader,
  type RegistryReaderOptions,
} from './chain/reader.ts';
import type { AppendedEvent } from './chain-reader.ts';

export interface NativeRegistryReaderOptions extends RegistryReaderOptions {
  /** Initialized API; its connection and lifetime remain caller-owned. */
  nativeApi: ApiPromise;
  /** Public lookup hints. The reader observes subsequent appends to this array. */
  blockHashes: readonly string[];
}

const CHAIN_ID = 420420777;
const GENESIS = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
const APPENDED_TOPIC = '0xf8c557326949317cd7769ba05fb911f13c76dbcb6883b4a38bee487cb1c31b47';
const hashSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/i)
  .transform((value) => value.toLowerCase() as Hex);
const blockHintsSchema = z.array(hashSchema).max(4096);
const logSchema = z.object({
  data: z
    .string()
    .regex(/^0x[0-9a-f]{192}$/i)
    .transform((value) => value as Hex),
  topics: z.tuple([hashSchema, hashSchema, hashSchema, hashSchema]),
});
interface VerifiedBlock {
  height: bigint;
  events: AppendedEvent[];
}

/** Read native Revive admissions alongside ordinary EVM history, trusting both RPCs. */
export async function createNativeRegistryReader({
  client,
  registry,
  fromBlock = 0n,
  nativeApi,
  blockHashes,
}: NativeRegistryReaderOptions): Promise<RegistryReader> {
  if ((await client.getChainId()) !== CHAIN_ID) {
    throw new Error(`Native registry reads require EVM chain ID ${CHAIN_ID}.`);
  }
  if (nativeApi.genesisHash.toHex().toLowerCase() !== GENESIS) {
    throw new Error('Native registry reads require the Portaldot testnet v3 genesis hash.');
  }
  const base = createRegistryReader({ client, registry, fromBlock });
  const verified = new Map<Hex, VerifiedBlock>();

  async function readBlock(
    hash: Hex,
    evmHeight: bigint,
    finalizedHeight: bigint,
  ): Promise<VerifiedBlock> {
    const { block } = await nativeApi.rpc.chain.getBlock(hash);
    const height = block.header.number.toBigInt();
    if (height > finalizedHeight) throw new Error(`Native block ${hash} is not finalized.`);
    if (height > evmHeight)
      throw new Error(`Native block ${hash} is ahead of the EVM reader height.`);
    const canonical = await nativeApi.rpc.chain.getBlockHash(height.toString());
    if (canonical.toHex().toLowerCase() !== hash) {
      throw new Error(`Native block ${hash} is not canonical at height ${height}.`);
    }
    const at = await nativeApi.at(hash);
    const records = await at.query.system.events();
    const events: AppendedEvent[] = [];
    for (const { event, phase } of records) {
      if (
        event.section !== 'revive' ||
        event.method !== 'ContractEmitted' ||
        !phase.isApplyExtrinsic
      )
        continue;
      if (event.data[0]?.toHex().toLowerCase() !== registry.toLowerCase()) continue;
      const rawTopics = event.data[2];
      // Native Vec codecs extend Array; metadata exposes this field only as Codec.
      if (!Array.isArray(rawTopics) || rawTopics[0]?.toHex().toLowerCase() !== APPENDED_TOPIC)
        continue;
      const { data, topics } = logSchema.parse({
        data: event.data[1]?.toHex(),
        topics: rawTopics.map((value: { toHex(): string }) => value.toHex()),
      });
      if (
        BigInt(topics[2]) > 0xffffffffffffffffn ||
        BigInt(`0x${data.slice(2, 66)}`) > 0xffffffffn ||
        !/^0x0{24}/i.test(topics[3])
      ) {
        throw new Error(`Malformed native Appended log in block ${hash}.`);
      }
      const extrinsic = block.extrinsics[phase.asApplyExtrinsic.toNumber()];
      if (!extrinsic)
        throw new Error(`Native Appended log in block ${hash} has no matching extrinsic.`);
      const decoded = decodeEventLog({
        abi: packoutRegistryAbi,
        eventName: 'Appended',
        data,
        topics,
        strict: true,
      });
      events.push({
        ...decoded.args,
        blockNumber: height,
        txHash: hashSchema.parse(extrinsic.hash.toHex()),
      });
    }
    const result = { height, events };
    // A failed fetch, canonicality check, or matching log must never populate the cache.
    verified.set(hash, result);
    return result;
  }

  async function history(wsId: Hex, fromIndex: bigint, toIndex: bigint): Promise<AppendedEvent[]> {
    const hashes = [...new Set(blockHintsSchema.parse(blockHashes))];
    if (fromIndex > toIndex) return [];
    const evmHeight = await client.getBlockNumber({ cacheTime: 0 });
    let finalizedHeight: bigint | undefined;
    const native: AppendedEvent[] = [];
    for (const hash of hashes) {
      let block = verified.get(hash);
      if (!block) {
        if (finalizedHeight === undefined) {
          const finalized = await nativeApi.rpc.chain.getFinalizedHead();
          const header = await nativeApi.rpc.chain.getHeader(finalized.toHex());
          finalizedHeight = header.number.toBigInt();
        }
        block = await readBlock(hash, evmHeight, finalizedHeight);
      }
      if (block.height > evmHeight) {
        throw new Error(`Native block ${hash} is ahead of the EVM reader height.`);
      }
      for (const event of block.events) {
        if (
          event.blockNumber >= fromBlock &&
          event.wsId.toLowerCase() === wsId.toLowerCase() &&
          event.index >= fromIndex &&
          event.index <= toIndex
        )
          native.push({ ...event });
      }
    }
    // Use the existing range reader even for points: it retains all EVM duplicates.
    const evm = await base.getAppendedRange(wsId, fromIndex, toIndex);
    const merged = new Map<bigint, AppendedEvent>();
    for (const event of [...evm, ...native]) {
      const existing = merged.get(event.index);
      if (existing) {
        if (
          existing.blockNumber !== event.blockNumber ||
          existing.epoch !== event.epoch ||
          existing.author.toLowerCase() !== event.author.toLowerCase() ||
          existing.digest.toLowerCase() !== event.digest.toLowerCase() ||
          existing.head.toLowerCase() !== event.head.toLowerCase()
        ) {
          throw new Error(`Conflicting Appended admissions for ${wsId} at index ${event.index}.`);
        }
      } else {
        // EVM events enter first, preserving their transaction identifiers on overlap.
        merged.set(event.index, event);
      }
    }
    return [...merged.values()].sort((a, b) =>
      a.index < b.index ? -1 : a.index > b.index ? 1 : 0,
    );
  }

  return {
    ...base,
    chainId: CHAIN_ID,
    async getAppended(wsId, index) {
      return (await history(wsId, index, index))[0] ?? null;
    },
    getAppendedRange: history,
  };
}
