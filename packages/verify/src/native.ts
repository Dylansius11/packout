import type { ApiPromise } from '@polkadot/api';
import type {} from '@polkadot/api/augment';
import { decodeEventLog, type Hex, parseAbiItem } from 'viem';
import { z } from 'zod';

export const DEFAULT_NATIVE_RPC = 'wss://test-node-v3.portaldot.dev';
const GENESIS = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
const TOPIC = '0xf8c557326949317cd7769ba05fb911f13c76dbcb6883b4a38bee487cb1c31b47';
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const nativeBlocksSchema = z
  .array(hash)
  .max(4096)
  .transform((hashes) => [...new Set(hashes.map((value) => value.toLowerCase() as Hex))]);
const wireSchema = z.tuple([
  z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  z.string().regex(/^0x[0-9a-fA-F]{192}$/),
  z.tuple([hash, hash, hash, hash]),
]);
// INTEGRATIONS 6.9 and SMART-CONTRACT 5 are the wire contract.
const appended = parseAbiItem(
  'event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head)',
);

export interface NativeOptions {
  nativeApi?: ApiPromise;
  blockHashes: readonly Hex[];
  rpc?: string;
}
export interface LocatedAdmission {
  wsId: Hex;
  index: bigint;
  author: Hex;
  epoch: number;
  digest: Hex;
  head: Hex;
  blockNumber: bigint;
  txHash: Hex;
}

export async function connectNative(rpc: string): Promise<ApiPromise> {
  // Native support is opt-in: EVM-only runs must not initialize the native API
  // module graph. The connection/transport module is loaded only at this boundary.
  const native = await import('./native-connection.ts');
  return native.connectNative(rpc);
}

export async function readNativeAdmissions(
  api: ApiPromise,
  registry: Hex,
  blockHashes: readonly Hex[],
  snapshot: bigint,
): Promise<LocatedAdmission[]> {
  if (api.genesisHash.toHex().toLowerCase() !== GENESIS)
    throw new Error('Native RPC genesis does not match the Portaldot testnet network.');
  const hashes = nativeBlocksSchema.parse(blockHashes);
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const finalized = (await api.rpc.chain.getHeader(finalizedHash)).number.toBigInt();
  const admissions: LocatedAdmission[] = [];
  for (const blockHash of hashes) {
    const { block } = await api.rpc.chain.getBlock(blockHash);
    const height = block.header.number.toBigInt();
    if (height < 0n || height > finalized) throw new Error('Native block is not finalized.');
    if (height > snapshot) throw new Error('Native block is ahead of the observed EVM snapshot.');
    const canonical = await api.rpc.chain.getBlockHash(height);
    if (
      canonical.toHex().toLowerCase() !== blockHash ||
      block.header.hash.toHex().toLowerCase() !== blockHash
    )
      throw new Error('Native block reference is not canonical at its claimed height.');
    const historical = await api.at(blockHash);
    const events = await historical.query.system.events();
    for (const { event, phase } of events) {
      if (
        event.section !== 'revive' ||
        event.method !== 'ContractEmitted' ||
        !phase.isApplyExtrinsic
      )
        continue;
      const raw = event.data.toJSON();
      if (
        !Array.isArray(raw) ||
        typeof raw[0] !== 'string' ||
        raw[0].toLowerCase() !== registry.toLowerCase()
      )
        continue;
      if (!Array.isArray(raw[2])) throw new Error('Malformed native registry event topics.');
      if (typeof raw[2][0] !== 'string' || raw[2][0].toLowerCase() !== TOPIC) continue;
      const parsed = wireSchema.safeParse(raw);
      if (!parsed.success) throw new Error('Malformed native Appended registry event.');
      const extrinsic = block.extrinsics[phase.asApplyExtrinsic.toNumber()];
      if (!extrinsic) throw new Error('Native admission has no matching phase-bound extrinsic.');
      const [, data, topics] = parsed.data;
      const decoded = decodeEventLog({
        abi: [appended],
        eventName: 'Appended',
        data: data as Hex,
        topics: topics as [Hex, Hex, Hex, Hex],
        strict: true,
      });
      if (decoded.args.index < 0n || decoded.args.index > 0xffffffffffffffffn)
        throw new Error('Native admission index exceeds uint64.');
      if (
        decoded.args.epoch < 0 ||
        decoded.args.epoch > 0xffffffff ||
        topics[3].slice(2, 26) !== '000000000000000000000000'
      )
        throw new Error('Malformed native admission epoch or author padding.');
      admissions.push({ ...decoded.args, blockNumber: height, txHash: extrinsic.hash.toHex() });
    }
  }
  // The reader pins one immutable finalized set for its lifetime, never caching
  // unverified references or accepting event contents supplied by the sidecar.
  return admissions;
}
