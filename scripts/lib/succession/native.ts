import { setTimeout as delay } from 'node:timers/promises';
import type { ApiPromise } from '@polkadot/api';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { Call, DispatchError } from '@polkadot/types/interfaces';
import { z } from 'zod';
import { requireInnerSuccess } from './model.ts';

export interface NativeEvidence {
  label: string;
  origin: string;
  evmCaller: string | null;
  extrinsicHash: string;
  blockNumber: string;
  blockHash: string;
  link: string;
  dispatch: string;
  balances: {
    address: string;
    before: unknown;
    after: unknown;
    holdsBefore: unknown;
    holdsAfter: unknown;
    freeDelta: string;
    reservedDelta: string;
    frozenDelta: string;
  }[];
  events: unknown[];
  feePaid: unknown;
}
export function dispatchReason(api: ApiPromise, error: DispatchError): string {
  if (!error.isModule) return error.toString();
  const decoded = api.registry.findMetaError(error.asModule);
  return `${decoded.section}.${decoded.name}`;
}
export async function sendNative(
  api: ApiPromise,
  signer: KeyringPair,
  call: Call,
  label: string,
  evmCaller: string | null,
  observed: KeyringPair[],
  evidence: NativeEvidence[],
  expectedError?: string,
) {
  console.log(
    `\n${label}: preparing; native origin ${signer.address}; EVM caller ${evmCaller ?? 'not an EVM call'}`,
  );
  const balance = z.object({
    data: z.object({
      free: z.union([z.string(), z.number()]).transform(BigInt),
      reserved: z.union([z.string(), z.number()]).transform(BigInt),
      frozen: z.union([z.string(), z.number()]).transform(BigInt),
    }),
  });
  const before = await Promise.all(
    observed.map(async (pair) => (await api.query.system.account(pair.address)).toJSON()),
  );
  const holdsBefore = await Promise.all(
    observed.map(async (pair) => (await api.query.balances.holds(pair.address)).toJSON()),
  );
  const tx = api.tx(call);
  const result = await new Promise<{ blockHash: string; events: unknown[]; dispatch: string }>(
    (resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        unsubscribe?.();
        reject(
          new Error(
            `${label}: finality timeout after 180 s; inspect submitted hash before retrying.`,
          ),
        );
      }, 180_000);
      tx.signAndSend(signer, { nonce: -1 }, (status) => {
        if (status.status.isBroadcast) console.log(`${label}: submitted ${tx.hash.toHex()}`);
        if (
          status.isError ||
          status.status.isInvalid ||
          status.status.isDropped ||
          status.status.isUsurped
        ) {
          settled = true;
          clearTimeout(timeout);
          unsubscribe?.();
          reject(new Error(`${label}: transaction ${status.status.type}.`));
        } else if (status.status.isFinalized) {
          settled = true;
          clearTimeout(timeout);
          unsubscribe?.();
          const dispatch = status.dispatchError ? dispatchReason(api, status.dispatchError) : 'Ok';
          resolve({
            blockHash: status.status.asFinalized.toHex(),
            events: status.events.map(({ event }) => ({
              section: event.section,
              method: event.method,
              data: event.data.toJSON(),
            })),
            dispatch,
          });
        }
      })
        .then((stop) => {
          unsubscribe = stop;
          if (settled) stop();
        })
        .catch((error: unknown) => {
          clearTimeout(timeout);
          reject(error);
        });
    },
  );
  const header = await api.rpc.chain.getHeader(result.blockHash);
  const at = await api.at(result.blockHash);
  const after = await Promise.all(
    observed.map(async (pair) => (await at.query.system.account(pair.address)).toJSON()),
  );
  const holdsAfter = await Promise.all(
    observed.map(async (pair) => (await at.query.balances.holds(pair.address)).toJSON()),
  );
  const entry: NativeEvidence = {
    label,
    origin: signer.address,
    evmCaller,
    extrinsicHash: tx.hash.toHex(),
    blockHash: result.blockHash,
    blockNumber: header.number.toString(),
    link: `https://scanner-testnet-v3.portaldot.dev/#/blocks/${header.number}`,
    dispatch: result.dispatch,
    events: result.events,
    feePaid: result.events.find((event) => {
      const parsed = z
        .object({
          section: z.literal('transactionPayment'),
          method: z.literal('TransactionFeePaid'),
        })
        .safeParse(event);
      return parsed.success;
    }),
    balances: observed.map((pair, i) => {
      const a = balance.parse(before[i]).data;
      const b = balance.parse(after[i]).data;
      return {
        address: pair.address,
        before: before[i],
        after: after[i],
        holdsBefore: holdsBefore[i],
        holdsAfter: holdsAfter[i],
        freeDelta: (b.free - a.free).toString(),
        reservedDelta: (b.reserved - a.reserved).toString(),
        frozenDelta: (b.frozen - a.frozen).toString(),
      };
    }),
  };
  evidence.push(entry);
  console.log(
    `${label}: ${entry.dispatch}; finalized block ${entry.blockNumber} ${entry.blockHash}; extrinsic ${entry.extrinsicHash}\n${entry.link}`,
  );
  console.log(
    `Balance deltas (native units; fee payer ${signer.address}, storage origin ${evmCaller ? observed[0].address : 'n/a'}): ${JSON.stringify(entry.balances.map(({ address, freeDelta, reservedDelta, frozenDelta }) => ({ address, freeDelta, reservedDelta, frozenDelta })))}`,
  );
  if (expectedError) {
    if (entry.dispatch !== `recovery.${expectedError}`)
      throw new Error(`${label}: expected recovery.${expectedError}, observed ${entry.dispatch}.`);
  } else {
    if (entry.dispatch !== 'Ok') throw new Error(`${label}: ${entry.dispatch}.`);
    if (Buffer.from(call.callIndex).toString('hex') === '1e00') {
      const eventSchema = z.object({
        section: z.literal('recovery'),
        method: z.literal('RecoveredAccountControlled'),
        data: z.array(z.unknown()),
      });
      const controlled = result.events
        .map((event) => eventSchema.safeParse(event))
        .find((event) => event.success);
      requireInnerSuccess(controlled?.success ? controlled.data.data[3] : undefined);
    }
  }
  return entry;
}
export async function waitUntilBlock(api: ApiPromise, target: bigint) {
  const deadline =
    Date.now() +
    Number(target - (await api.rpc.chain.getHeader()).number.toBigInt()) * 12_000 +
    180_000;
  while ((await api.rpc.chain.getHeader()).number.toBigInt() < target) {
    if (Date.now() > deadline) throw new Error(`Waiting for native block ${target} timed out.`);
    await delay(1500);
  }
}
