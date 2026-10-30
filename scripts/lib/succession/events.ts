import type { AppendedEvent, ChainReader } from '@packout/sdk';
import { packoutRegistryAbi } from '@packout/sdk';
import type { ApiPromise } from '@polkadot/api';
import { type Address, decodeEventLog, type Hex, toEventSelector } from 'viem';
import { z } from 'zod';

const appendedTopic = toEventSelector('Appended(bytes32,uint64,address,uint32,bytes32,bytes32)');
const hex = z
  .string()
  .regex(/^0x(?:[\da-fA-F]{2})*$/)
  .transform((value) => value as Hex);
const emittedSchema = z.object({
  section: z.literal('revive'),
  method: z.literal('ContractEmitted'),
  data: z.tuple([z.string(), hex, z.array(hex)]),
});

export function decodeNativeAppends(
  registry: Address,
  events: unknown[],
  blockNumber: bigint,
  extrinsicHash: Hex,
): AppendedEvent[] {
  const result: AppendedEvent[] = [];
  for (const event of events) {
    const parsed = emittedSchema.safeParse(event);
    if (!parsed.success) continue;
    const [address, data, topics] = parsed.data.data;
    if (address.toLowerCase() !== registry.toLowerCase() || topics[0] !== appendedTopic) continue;
    const decoded = decodeEventLog({
      abi: packoutRegistryAbi,
      eventName: 'Appended',
      data,
      topics: topics as [Hex, ...Hex[]],
      strict: true,
    });
    result.push({ ...decoded.args, blockNumber, txHash: extrinsicHash });
  }
  return result;
}

// Only finalized, canonical blocks are admitted. Saved block references are untrusted input;
// events and their extrinsic hashes are read again from the native node, not from a local report.
export async function loadNativeAppends(
  api: ApiPromise,
  registry: Address,
  blockHashes: Hex[],
): Promise<AppendedEvent[]> {
  const finalized = await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());
  const result: AppendedEvent[] = [];
  for (const hash of new Set(blockHashes)) {
    const block = await api.rpc.chain.getBlock(hash);
    const number = block.block.header.number;
    if (
      number.toBigInt() > finalized.number.toBigInt() ||
      (await api.rpc.chain.getBlockHash(number.toBigInt())).toHex() !== hash
    )
      throw new Error('Native history reference is not a finalized canonical block.');
    const at = await api.at(hash);
    for (const { phase, event } of await at.query.system.events()) {
      if (!phase.isApplyExtrinsic) continue;
      const tx = block.block.extrinsics[phase.asApplyExtrinsic.toNumber()];
      if (!tx) throw new Error('Native history event has no corresponding extrinsic.');
      result.push(
        ...decodeNativeAppends(
          registry,
          [
            {
              section: event.section,
              method: event.method,
              data: event.data.toJSON(),
            },
          ],
          number.toBigInt(),
          tx.hash.toHex(),
        ),
      );
    }
  }
  return result;
}

// Testnet's Ethereum RPC omits logs from native Revive.call (including inherited dispatch).
// Keep the ordinary EVM reader for state/vendor events and supply real native receipts for W.
export function successionReader(base: ChainReader, native: AppendedEvent[]): ChainReader {
  return {
    chainId: base.chainId,
    registry: base.registry,
    getWorkspace: (wsId) => base.getWorkspace(wsId),
    async getAppended(wsId, index) {
      const matches = native.filter((event) => event.wsId === wsId && event.index === index);
      if (matches.length > 1)
        throw new Error('Conflicting native history references at one index.');
      return matches[0] ?? base.getAppended(wsId, index);
    },
  };
}
