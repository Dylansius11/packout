import type { ApiPromise } from '@polkadot/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readChain } from '../src/chain.ts';
import { verifyBundle } from '../src/verify.ts';
import {
  close,
  evmTx,
  listen,
  nativeFixture,
  nativeHash,
  nativeTx,
  owner,
  wsId,
} from './native-fixture.ts';

let fixture = nativeFixture();
let rpc: string;
beforeEach(async () => {
  fixture = nativeFixture();
  rpc = await listen(fixture.server);
});
afterEach(async () => {
  await close(fixture.server);
});

function nativeOptions(blockHashes = [nativeHash]) {
  // Only the external native query surface is doubled; chain verification remains real.
  return {
    nativeApi: fixture.nativeApi as unknown as ApiPromise,
    blockHashes,
    rpc: 'http://native.test',
  };
}

describe('independent native admission safety', () => {
  it('skips rather than passes decryption without a key', async () => {
    const report = await verifyBundle({ bundle: fixture.bundle, rpc, native: nativeOptions() });
    expect(report.ok).toBe(true);
    expect(report.steps[5].status).toBe('skipped');
  });

  it('rejects a wrong key after the five native proof checks pass', async () => {
    const report = await verifyBundle({
      bundle: fixture.bundle,
      key: new Uint8Array(32),
      rpc,
      native: nativeOptions(),
    });
    expect(report.ok).toBe(false);
    expect(report.steps.map((step) => step.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'fail',
    ]);
  });

  it('does not treat omitted final hints as verified history', async () => {
    const report = await verifyBundle({ bundle: fixture.bundle, rpc, native: nativeOptions([]) });
    expect(report.ok).toBe(false);
    expect(report.steps[3].status).toBe('fail');
  });
  it('rejects altered encrypted history before treating native events as proof', async () => {
    const lastByte = fixture.bundle.envelopes[1].endsWith('00') ? '01' : '00';
    fixture.bundle.envelopes[1] =
      `${fixture.bundle.envelopes[1].slice(0, -2)}${lastByte}` as `0x${string}`;
    const report = await verifyBundle({ bundle: fixture.bundle, rpc, native: nativeOptions() });
    expect(report.ok).toBe(false);
    expect(report.steps[2].status).toBe('fail');
  });

  it('returns the phase-bound native extrinsic identifier and normalized duplicate references', async () => {
    const chain = await readChain(
      fixture.bundle,
      rpc,
      nativeOptions([nativeHash, `0x${nativeHash.slice(2).toUpperCase()}`]),
    );
    expect(await chain.getAppended(wsId, 1n)).toMatchObject({
      index: 1n,
      author: owner,
      blockNumber: 100n,
      txHash: nativeTx,
    });
    expect(await chain.getAppended(wsId, 0n)).toMatchObject({ index: 0n, txHash: evmTx });
    expect(await chain.getAppended(`0x${'99'.repeat(32)}`, 1n)).toBeNull();
  });

  it('deduplicates identical same-block admissions across sources and prefers the EVM identifier', async () => {
    fixture.state.evmIndices = [0, 1, 1];
    const chain = await readChain(fixture.bundle, rpc, nativeOptions());
    expect(await chain.getAppended(wsId, 1n)).toMatchObject({ index: 1n, txHash: evmTx });
  });

  it.each(['author', 'epoch', 'digest', 'height'])(
    'rejects conflicting %s across EVM/native sources',
    async (field) => {
      fixture.state.evmIndices = [0, 1];
      if (field === 'author') fixture.state.evmAuthor = `0x${'66'.repeat(20)}`;
      if (field === 'epoch') fixture.state.evmEpoch = 1;
      if (field === 'digest') fixture.state.evmDigest = `0x${'77'.repeat(32)}`;
      if (field === 'height') fixture.state.evmHeight = 99n;
      const report = await verifyBundle({ bundle: fixture.bundle, rpc, native: nativeOptions() });
      expect(report.ok).toBe(false);
      expect(report.steps[3]).toMatchObject({
        status: 'fail',
        message: expect.stringMatching(/ambiguous|conflict/i),
      });
    },
  );

  it.each([
    'native-network',
    'evm-network',
    'noncanonical',
    'unfinalized',
    'future',
    'unknown',
    'missing-extrinsic',
    'bad-data',
    'bad-topics',
  ])('fails closed for %s proof', async (kind) => {
    if (kind === 'native-network') fixture.state.genesis = `0x${'00'.repeat(32)}`;
    if (kind === 'evm-network') {
      fixture.state.chainId = 1;
      fixture.bundle.chainId = 1;
    }
    if (kind === 'noncanonical') fixture.state.canonical = `0x${'00'.repeat(32)}`;
    if (kind === 'unfinalized') fixture.state.finalized = 99n;
    if (kind === 'future') fixture.state.snapshot = 99n;
    if (kind === 'missing-extrinsic') fixture.state.extrinsics = [];
    if (kind === 'bad-data')
      fixture.state.events[0].event.data[1] = { toHex: () => '0x00', toString: () => '0x00' };
    if (kind === 'bad-topics')
      fixture.state.events[0].event.data[2] = [fixture.state.events[0].event.data[2][0]];
    const hashes = kind === 'unknown' ? [`0x${'00'.repeat(32)}` as const] : [nativeHash];
    const report = await verifyBundle({
      bundle: fixture.bundle,
      rpc,
      native: nativeOptions(hashes),
    });
    expect(report.ok).toBe(false);
    expect(report.steps[3].status).toBe('fail');
    expect(report.steps[4].status).toBe('not checked');
  });

  it.each(['contract', 'topic', 'phase'])(
    'ignores unrelated %s instead of accepting its event',
    async (kind) => {
      const record = fixture.state.events[0];
      if (kind === 'contract') record.event.data[0] = { toHex: () => owner, toString: () => owner };
      if (kind === 'topic') record.event.data[2][0] = { toHex: () => wsId, toString: () => wsId };
      if (kind === 'phase') record.phase.isApplyExtrinsic = false;
      const report = await verifyBundle({ bundle: fixture.bundle, rpc, native: nativeOptions() });
      expect(report.ok).toBe(false);
      expect(report.steps[3].status).toBe('fail');
    },
  );

  it('rejects two different native admissions for the same workspace/index', async () => {
    const conflicting = fixture.wire(1);
    conflicting.event.data[1] = {
      toHex: () => `0x${'00'.repeat(96)}`,
      toString: () => `0x${'00'.repeat(96)}`,
    };
    fixture.state.events.push(conflicting);
    const report = await verifyBundle({ bundle: fixture.bundle, rpc, native: nativeOptions() });
    expect(report.ok).toBe(false);
    expect(report.steps[3]).toMatchObject({
      status: 'fail',
      message: expect.stringMatching(/ambiguous|conflict/i),
    });
  });

  it('keeps workspace and event reads pinned to the original EVM snapshot', async () => {
    const chain = await readChain(fixture.bundle, rpc, nativeOptions());
    fixture.state.snapshot = 200n;
    fixture.state.evmIndices = [0, 1];
    fixture.state.evmHeight = 200n;
    expect(await chain.getWorkspace(wsId)).toMatchObject({ count: 2n });
    expect(await chain.getAppended(wsId, 1n)).toMatchObject({ txHash: nativeTx });
  });
});
