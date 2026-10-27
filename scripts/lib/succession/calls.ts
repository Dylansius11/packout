import { JOURNAL_SCHEMA_ID, packoutRegistryAbi, ZERO_HEAD } from '@packout/sdk';
import type { Call } from '@polkadot/types/interfaces';
import type { Registry } from '@polkadot/types/types';
import { decodeAddress } from '@polkadot/util-crypto';
import { type Address, encodeFunctionData, type Hex, serializeTransaction } from 'viem';
import { fundingPlan, UNIT } from './model.ts';

export interface NativeAccounts {
  W: string;
  N: string;
  backups: string[];
}
export const WEIGHT = { refTime: 1_000_000_000_000n, proofSize: 1_000_000n };
// Matches the funded budget for W's workspace storage (INTEGRATIONS 6.4: 15.96 tPOT upper bound).
export const STORAGE_LIMIT = 16n * UNIT;
export function nativeCall(registry: Registry, index: string, args: unknown[]) {
  return registry.createType('Call', {
    callIndex: Uint8Array.from(Buffer.from(index.slice(2), 'hex')),
    args,
  });
}
export function reviveCall(
  registry: Registry,
  address: Address,
  data: Hex,
  weight = WEIGHT,
  storage = STORAGE_LIMIT,
) {
  return nativeCall(registry, '0x5001', [address, 0, weight, storage, data]);
}
export function buildCalls(
  registry: Registry,
  accounts: NativeAccounts,
  address: Address,
  wsId: Hex,
  salt: Hex,
  vendor: Address,
  delayBlocks: number,
) {
  const calls: { name: string; origin: string; index: string; call: Call }[] = [];
  const add = (name: string, origin: string, index: string, args: unknown[]) =>
    calls.push({ name, origin, index, call: nativeCall(registry, index, args) });
  const funds = fundingPlan();
  // Balances.transfer_keep_alive is verified from the pinned metadata by round-trip tests.
  for (const [index, recipient] of [accounts.N, ...accounts.backups].entries()) {
    add(`forward-${index}`, accounts.W, '0x0603', [
      recipient,
      index === 0 ? funds.forward.N : funds.forward.B1,
    ]);
  }
  const encode = (
    functionName: 'createWorkspace' | 'grantWriter' | 'rotateEpoch' | 'appendBatch',
    args: readonly unknown[],
  ) => encodeFunctionData({ abi: packoutRegistryAbi, functionName, args: args as never });
  const create = reviveCall(
    registry,
    address,
    encode('createWorkspace', [salt, JOURNAL_SCHEMA_ID]),
  );
  const grant = reviveCall(registry, address, encode('grantWriter', [wsId, vendor]));
  const append = reviveCall(
    registry,
    address,
    encode('appendBatch', [wsId, 1n, ZERO_HEAD, [salt]]),
  );
  const rotate = reviveCall(registry, address, encode('rotateEpoch', [wsId, []]));
  for (const [name, call] of [
    ['create', create],
    ['grant', grant],
    ['native-append', append],
  ] as const)
    calls.push({ name, origin: accounts.W, index: '0x5001', call });
  add('configure', accounts.W, '0x1e02', [
    [
      {
        friends: [...accounts.backups].sort((a, b) =>
          Buffer.compare(decodeAddress(a), decodeAddress(b)),
        ),
        friendsNeeded: 2,
        inheritor: accounts.N,
        inheritanceDelay: delayBlocks,
        inheritancePriority: 0,
        cancelDelay: delayBlocks,
      },
    ],
  ]);
  add('initiate-A', accounts.backups[0], '0x1e03', [accounts.W, 0]);
  add('cancel-A', accounts.W, '0x1e06', [accounts.W, 0]);
  add('initiate-B', accounts.backups[0], '0x1e03', [accounts.W, 0]);
  add('finish-one-approval', accounts.N, '0x1e05', [accounts.W, 0]);
  add('approve-B', accounts.backups[1], '0x1e04', [accounts.W, 0]);
  add('finish-before-delay', accounts.N, '0x1e05', [accounts.W, 0]);
  add('control-before-inheritance', accounts.N, '0x1e00', [accounts.W, rotate]);
  add('finish', accounts.N, '0x1e05', [accounts.W, 0]);
  add('inherited-rotate', accounts.N, '0x1e00', [accounts.W, rotate]);
  add('inherited-append', accounts.N, '0x1e00', [accounts.W, append]);
  for (const [name, count] of [
    ['vendor-append', 0n],
    ['vendor-refusal', 3n],
  ] as const) {
    const payload = serializeTransaction(
      {
        chainId: 420420777,
        type: 'legacy',
        nonce: 0,
        gas: 1_000_000_000_000_000n,
        gasPrice: 10_000_000_000n,
        to: address,
        value: 0n,
        data: encode('appendBatch', [wsId, count, ZERO_HEAD, [salt]]),
      },
      { r: `0x${'00'.repeat(31)}01`, s: `0x${'00'.repeat(31)}01`, v: 27n },
    );
    // The signature is fabricated r=s=1; never signed with the vendor key and never submitted.
    add(name, accounts.W, '0x5000', [payload]);
  }
  return calls;
}
