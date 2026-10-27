import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Metadata, TypeRegistry } from '@polkadot/types';
import { describe, expect, it } from 'vitest';
import { executionBounds } from '../lib/succession/bounds.ts';
import { buildCalls } from '../lib/succession/calls.ts';
import { fundingPlan, preflightReady, requireInnerSuccess } from '../lib/succession/model.ts';
import { metadataFingerprint } from '../lib/succession/pin.ts';

const registry = new TypeRegistry();
const metadata = new Metadata(
  registry,
  gunzipSync(
    readFileSync(new URL('fixtures/succession-metadata.hex.gz', import.meta.url)),
  ).toString() as `0x${string}`,
);
registry.setMetadata(metadata, []);
const account = (byte: string) => `0x${byte.repeat(32)}`;

describe('succession safety', () => {
  it('requires a successful EVM dry-run and budgets the maximum transient storage charge', () => {
    const result = {
      weightRequired: { refTime: 1000, proofSize: 200 },
      storageDeposit: { charge: 20 },
      maxStorageDeposit: { charge: 30 },
      result: { ok: { flags: { bits: 0 }, data: '0x' } },
    };
    expect(executionBounds(result)).toEqual({
      weight: { refTime: 1000n, proofSize: 200n },
      storage: 30n,
      deposit: { charge: 20n },
    });
    expect(() =>
      executionBounds({ ...result, result: { err: 'StorageDepositNotEnoughFunds' } }),
    ).toThrow('dispatch failed');
    expect(() =>
      executionBounds({ ...result, result: { ok: { flags: { bits: 1 }, data: '0x1234' } } }),
    ).toThrow('EVM reverted');
  });
  it('ignores only the dynamic EthBlockBuilderIR fallback, never call or type changes', () => {
    const snapshot = metadata.toJSON();
    const changed = structuredClone(snapshot) as unknown as {
      metadata: {
        v16: { pallets: { index: number; storage: { items: { fallback: string }[] } }[] };
      };
    };
    changed.metadata.v16.pallets[57].storage.items[11].fallback = '0x00';
    expect(metadataFingerprint(changed)).toBe(metadataFingerprint(snapshot));
    changed.metadata.v16.pallets[57].index = 81;
    expect(metadataFingerprint(changed)).not.toBe(metadataFingerprint(snapshot));
  });
  it('budgets forwarding and retained funds entirely in native bigint units', () => {
    const plan = fundingPlan();
    expect(plan.requiredW).toBe(1850000000000000n);
    expect(plan.forwarded).toBe(100000000000000n);
    expect(plan.retainedW).toBe(1750000000000000n);
    expect(plan.forward.N).toBe(40000000000000n);
  });
  it('reuses the funded workspace and tops up only spent recipient balances', () => {
    const plan = fundingPlan([
      30_000_000_000_000n,
      20_000_000_000_000n,
      30_000_000_000_000n,
      20_000_000_000_000n,
    ]);
    expect(plan.forward).toEqual({ N: 10_000_000_000_000n, B1: 0n, B2: 0n, B3: 0n });
    expect(plan.requiredW).toBe(460_000_000_000_000n);
    expect(plan.retainedW).toBe(450_000_000_000_000n);
  });
  it('blocks readiness on any failed checklist item', () => {
    expect(preflightReady([{ pass: true }, { pass: false }])).toBe(false);
    expect(preflightReady([{ pass: true }])).toBe(true);
    expect(preflightReady([])).toBe(false);
  });
  it('refuses inner dispatch failure even when the outer extrinsic succeeded', () => {
    expect(() =>
      requireInnerSuccess({ err: { module: { index: 80, error: '0x01000000' } } }),
    ).toThrow('inner dispatch failed');
    expect(() => requireInnerSuccess(undefined)).toThrow('missing');
    expect(() => requireInnerSuccess({ ok: null })).not.toThrow();
  });
  it('round-trips every call and argument with pinned v16 metadata', () => {
    const calls = buildCalls(
      registry,
      {
        W: account('11'),
        N: account('22'),
        backups: [account('55'), account('33'), account('44')],
      },
      '0x0000000000000000000000000000000000000001',
      `0x${'66'.repeat(32)}`,
      `0x${'77'.repeat(32)}`,
      '0x0000000000000000000000000000000000000002',
      10,
    );
    expect(calls.map((call) => call.index)).toEqual([
      '0x0603',
      '0x0603',
      '0x0603',
      '0x0603',
      '0x5001',
      '0x5001',
      '0x5001',
      '0x1e02',
      '0x1e03',
      '0x1e06',
      '0x1e03',
      '0x1e05',
      '0x1e04',
      '0x1e05',
      '0x1e00',
      '0x1e05',
      '0x1e00',
      '0x1e00',
      '0x5000',
      '0x5000',
    ]);
    for (const call of calls) {
      const decoded = registry.createType('Call', call.call.toHex());
      expect(decoded.toHex()).toBe(call.call.toHex());
      expect(call.call.toHex().slice(0, 6)).toBe(call.index);
    }
    expect(calls.find((call) => call.name === 'configure')?.call.toHuman()).toMatchObject({
      section: 'recovery',
      method: 'setFriendGroups',
    });
    const configure = calls.find((call) => call.name === 'configure');
    expect(configure?.call.toJSON()).toMatchObject({
      callIndex: '0x1e02',
      args: {
        friend_groups: [
          { friendsNeeded: 2, inheritanceDelay: 10, cancelDelay: 10, inheritancePriority: 0 },
        ],
      },
    });
    expect(calls.map((call) => call.index)).toContain('0x5001');
    expect(calls.map((call) => call.index)).toContain('0x1e00');
  });
});
