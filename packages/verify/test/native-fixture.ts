import { createServer, type Server } from 'node:http';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  concat,
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
  keccak256,
  parseAbiItem,
  stringToHex,
} from 'viem';
import { nextHead, ZERO_HEAD } from '../src/head.ts';

export const GENESIS = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
export const nativeHash: Hex = `0x${'ab'.repeat(32)}`;
export const nativeTx: Hex = `0x${'cd'.repeat(32)}`;
export const evmTx: Hex = `0x${'ef'.repeat(32)}`;
const evmHash: Hex = `0x${'ee'.repeat(32)}`;
export const wsId: Hex = `0x${'11'.repeat(32)}`;
export const registry: Hex = `0x${'33'.repeat(20)}`;
export const owner: Hex = `0x${'22'.repeat(20)}`;
const schemaId = keccak256(stringToHex('packout.journal/1'));
const appended = parseAbiItem(
  'event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head)',
);
const hashCodec = (value: string) => ({ toHex: () => value, toString: () => value });
const numberCodec = (value: bigint) => ({
  toBigInt: () => value,
  toNumber: () => Number(value),
  toString: () => String(value),
});

interface HexCodec {
  toHex(): string;
  toString(): string;
}
interface NativeRecord {
  phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } };
  event: {
    section: string;
    method: string;
    data: [HexCodec, HexCodec, HexCodec[]] & { toJSON(): unknown };
  };
}

export function nativeFixture() {
  const key = new Uint8Array(32).fill(7);
  let head = ZERO_HEAD;
  const admissions = [0, 1].map((index) => {
    const nonce = new Uint8Array(24).fill(index + 1);
    const op = {
      v: 1,
      wsId,
      opId: `0x${String(index + 4).repeat(32)}`,
      ts: index,
      author: { memberId: `0x${'55'.repeat(16)}`, name: 'Dina' },
      type: 'issue.create',
      body: { title: 'Private native history', description: '' },
    };
    const envelope = bytesToHex(
      concat([
        new Uint8Array([1]),
        nonce,
        xchacha20poly1305(key, nonce, new Uint8Array(32).fill(0x11)).encrypt(
          new TextEncoder().encode(JSON.stringify(op)),
        ),
      ]),
    );
    const digest = keccak256(envelope);
    head = nextHead(wsId, BigInt(index), head, digest);
    return { wsId, index: BigInt(index), author: owner, epoch: 0, digest, head, envelope };
  });
  const bundle = {
    format: 'packout.bundle/1' as const,
    chainId: 420420777,
    registry,
    wsId,
    schemaId,
    envelopes: admissions.map((event) => event.envelope),
    checkpoint: { count: 2, head, blockNumber: 0 },
  };
  const wire = (index: number): NativeRecord => {
    const event = admissions[index];
    const data: [HexCodec, HexCodec, HexCodec[]] = [
      hashCodec(registry),
      hashCodec(
        encodeAbiParameters(
          [{ type: 'uint32' }, { type: 'bytes32' }, { type: 'bytes32' }],
          [event.epoch, event.digest, event.head],
        ),
      ),
      encodeEventTopics({
        abi: [appended],
        eventName: 'Appended',
        args: { wsId, index: event.index, author: owner },
      }).map((topic) => hashCodec(topic as Hex)),
    ];
    return {
      phase: { isApplyExtrinsic: true, asApplyExtrinsic: numberCodec(0n) },
      event: {
        section: 'revive',
        method: 'ContractEmitted',
        data: Object.assign(data, {
          toJSON: () => [data[0].toHex(), data[1].toHex(), data[2].map((topic) => topic.toHex())],
        }),
      },
    };
  };
  const state = {
    chainId: 420420777,
    snapshot: 100n,
    finalized: 100n,
    height: 100n,
    canonical: nativeHash,
    genesis: GENESIS,
    events: [wire(1)],
    extrinsics: [{ hash: hashCodec(nativeTx) }],
    evmIndices: [0] as number[],
    evmHeight: 100n,
    evmAuthor: owner,
    evmEpoch: 0,
    evmDigest: admissions[1].digest,
    workspaceHead: head,
    disconnected: false,
  };
  const header = (height: bigint, hash: Hex) => ({
    number: numberCodec(height),
    hash: hashCodec(hash),
  });
  const nativeApi = {
    get genesisHash() {
      return hashCodec(state.genesis);
    },
    rpc: {
      chain: {
        getFinalizedHead: async () => hashCodec(nativeHash),
        getHeader: async () => header(state.finalized, nativeHash),
        getBlockHash: async (height: unknown) =>
          hashCodec(String(height) === '0' ? state.genesis : state.canonical),
        getBlock: async (hash: unknown) => {
          if (String(hash) !== nativeHash) throw new Error('Unknown native block');
          return {
            block: { header: header(state.height, nativeHash), extrinsics: state.extrinsics },
          };
        },
      },
    },
    at: async () => ({ query: { system: { events: async () => state.events } } }),
    disconnect: async () => {
      state.disconnected = true;
    },
  };
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const call = JSON.parse(body);
    let result: unknown;
    if (call.method === 'eth_chainId') result = `0x${state.chainId.toString(16)}`;
    else if (call.method === 'eth_blockNumber') result = `0x${state.snapshot.toString(16)}`;
    else if (call.method === 'eth_call') {
      result = encodeAbiParameters(
        [
          { type: 'address' },
          { type: 'uint32' },
          { type: 'uint64' },
          { type: 'bytes32' },
          { type: 'bytes32' },
        ],
        [owner, 0, call.params[1] === '0x64' ? 2n : 3n, state.workspaceHead, schemaId],
      );
    } else if (call.method === 'eth_getLogs') {
      const toBlock = call.params[0].toBlock;
      const bound =
        toBlock === undefined || toBlock === 'latest' ? state.snapshot : BigInt(toBlock);
      result = state.evmIndices
        .map((index) => {
          const event = admissions[index];
          return {
            address: registry,
            topics: encodeEventTopics({
              abi: [appended],
              eventName: 'Appended',
              args: { wsId, index: event.index, author: state.evmAuthor },
            }),
            data: encodeAbiParameters(
              [{ type: 'uint32' }, { type: 'bytes32' }, { type: 'bytes32' }],
              [state.evmEpoch, index === 1 ? state.evmDigest : event.digest, event.head],
            ),
            blockNumber: `0x${state.evmHeight.toString(16)}`,
            blockHash: evmHash,
            transactionHash: evmTx,
            transactionIndex: '0x0',
            logIndex: `0x${index.toString(16)}`,
            removed: false,
          };
        })
        .filter(
          (event) =>
            BigInt(event.blockNumber) <= bound &&
            (call.params[0].topics[2] == null || event.topics[2] === call.params[0].topics[2]),
        );
    } else {
      response.writeHead(400);
      response.end();
      return;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
  });
  return { bundle, key, admissions, state, nativeApi, server, wire };
}

export async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test RPC failed to listen');
  return `http://127.0.0.1:${address.port}`;
}
export async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
