import type { Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import { createNativeRegistryReader } from '../src/native.ts';
import {
  blockHash,
  evmTxHash,
  extrinsicHash,
  hexCodec,
  nativeEvent,
  fixture as nativeFixture,
  nextHash,
  numberCodec,
  otherWsId,
  record,
  topic,
  upper,
  wsId,
} from './native-fixture.ts';

const fixture = () => nativeFixture(createNativeRegistryReader);

describe('native RegistryReader safety', () => {
  it('retains the hint array and discovers later finalized writes', async () => {
    const f = fixture();
    const reader = await f.create();
    expect(await reader.getAppended(wsId, 2n)).toBeNull();
    f.state.blocks.set(nextHash, {
      height: 248296n,
      events: [record({ ...nativeEvent, index: 2n })],
      extrinsics: [evmTxHash],
    });
    f.blockHashes.push(nextHash);
    expect(await reader.getAppended(wsId, 2n)).toMatchObject({
      index: 2n,
      blockNumber: 248296n,
      txHash: evmTxHash,
    });
  });

  it('normalizes and deduplicates hints and reuses only verified finalized bodies', async () => {
    const f = fixture();
    f.blockHashes.push(upper(blockHash));
    const reader = await f.create();
    expect(await reader.getAppendedRange(wsId, 0n, 2n)).toHaveLength(1);
    f.state.unreadable = true;
    expect(await reader.getAppended(wsId, 1n)).toMatchObject({ txHash: extrinsicHash });
  });

  it('applies fromBlock to native and EVM events', async () => {
    const f = fixture();
    f.state.evm = [{ ...nativeEvent, index: 0n, blockNumber: 248294n }];
    const reader = await f.create(248296n);
    expect(await reader.getAppended(wsId, 1n)).toBeNull();
    expect(await reader.getAppendedRange(wsId, 0n, 2n)).toEqual([]);
  });

  it.each(['contract', 'topic', 'phase', 'pallet'] as const)(
    'ignores unrelated %s records',
    async (kind) => {
      const f = fixture();
      const event = record();
      if (kind === 'contract')
        event.event.data[0] = hexCodec('0x0000000000000000000000000000000000000001');
      if (kind === 'topic') event.event.data[2] = [hexCodec(otherWsId)];
      if (kind === 'phase') event.phase.isApplyExtrinsic = false;
      if (kind === 'pallet') event.event.section = 'system';
      f.nativeBlock.events = [event];
      expect(await (await f.create()).getAppended(wsId, 1n)).toBeNull();
    },
  );

  it.each(['data', 'topics', 'extrinsic'] as const)(
    'rejects matching malformed %s proof',
    async (kind) => {
      const f = fixture();
      const event = record();
      if (kind === 'data') event.event.data[1] = hexCodec('0x');
      if (kind === 'topics') event.event.data[2] = [hexCodec(topic), hexCodec(wsId)];
      if (kind === 'extrinsic') event.phase.asApplyExtrinsic = numberCodec(2n);
      f.nativeBlock.events = [event];
      await expect((await f.create()).getAppended(wsId, 1n)).rejects.toThrow();
    },
  );

  it.each(['evm', 'native'] as const)('rejects the wrong actual %s network', async (kind) => {
    const f = fixture();
    if (kind === 'evm') f.state.chainId = 1;
    else f.state.genesis = otherWsId;
    await expect(f.create()).rejects.toThrow(/chain|network|genesis/i);
  });

  it.each(['unknown', 'noncanonical', 'unfinalized', 'future'] as const)(
    'rejects %s block references',
    async (kind) => {
      const f = fixture();
      if (kind === 'unknown') f.blockHashes[0] = nextHash;
      if (kind === 'noncanonical') f.state.canonical.set(248295n, nextHash);
      if (kind === 'unfinalized') f.state.finalizedHeight = 248294n;
      if (kind === 'future') f.state.evmHeight = 248294n;
      await expect((await f.create()).getAppended(wsId, 1n)).rejects.toThrow();
    },
  );

  it('does not cache a failed unfinalized proof', async () => {
    const f = fixture();
    f.state.finalizedHeight = 248294n;
    const reader = await f.create();
    await expect(reader.getAppended(wsId, 1n)).rejects.toThrow();
    f.state.finalizedHeight = 248300n;
    expect(await reader.getAppended(wsId, 1n)).toMatchObject({ index: 1n });
  });

  it('isolates cached node proof from mutation of earlier point and range results', async () => {
    const f = fixture();
    const reader = await f.create();
    const first = await reader.getAppended(wsId, 1n);
    if (!first) throw new Error('Fixture native admission was not found.');
    first.head = otherWsId;
    first.digest = otherWsId;
    first.index = 2n;
    const range = await reader.getAppendedRange(wsId, 1n, 1n);
    expect(range).toHaveLength(1);
    expect(range[0]).toMatchObject({
      index: 1n,
      head: nativeEvent.head,
      digest: nativeEvent.digest,
    });
    range[0].head = otherWsId;
    f.state.evm = [{ ...nativeEvent, txHash: evmTxHash }];
    expect(await reader.getAppended(wsId, 1n)).toMatchObject({
      index: 1n,
      head: nativeEvent.head,
      digest: nativeEvent.digest,
      txHash: evmTxHash,
    });
  });

  it.each(['malformed', 'too many'] as const)(
    'revalidates appended %s hints before every read',
    async (kind) => {
      const f = fixture();
      const reader = await f.create();
      await reader.getAppended(wsId, 1n);
      if (kind === 'malformed') f.blockHashes.push('0x1234');
      else f.blockHashes.push(...Array<Hex>(4096).fill(blockHash));
      await expect(reader.getAppended(wsId, 1n)).rejects.toThrow();
    },
  );

  it('merges identical source overlap ignoring hex case and prefers the EVM identifier', async () => {
    const f = fixture();
    f.state.evm = [
      {
        ...nativeEvent,
        wsId: upper(wsId),
        author: upper(nativeEvent.author),
        digest: upper(nativeEvent.digest),
        head: upper(nativeEvent.head),
        txHash: evmTxHash,
      },
    ];
    f.nativeBlock.events.push(record());
    const reader = await f.create();
    expect(await reader.getAppended(wsId, 1n)).toMatchObject({ txHash: evmTxHash });
    expect(await reader.getAppendedRange(wsId, 0n, 2n)).toHaveLength(1);
  });

  it.each(['author', 'epoch', 'digest', 'head', 'height'] as const)(
    'rejects same-index conflicts in %s',
    async (kind) => {
      const f = fixture();
      const conflicting = { ...nativeEvent, txHash: evmTxHash };
      if (kind === 'author') conflicting.author = '0x0000000000000000000000000000000000000001';
      if (kind === 'epoch') conflicting.epoch = 1;
      if (kind === 'digest') conflicting.digest = otherWsId;
      if (kind === 'head') conflicting.head = otherWsId;
      if (kind === 'height') conflicting.blockNumber = 248296n;
      f.state.evm = [conflicting];
      const reader = await f.create();
      await expect(reader.getAppended(wsId, 1n)).rejects.toThrow(/conflict|ambiguous/i);
      await expect(reader.getAppendedRange(wsId, 0n, 2n)).rejects.toThrow(/conflict|ambiguous/i);
    },
  );

  it('rejects conflicting EVM-only indices rather than taking the first log', async () => {
    const f = fixture();
    f.blockHashes.length = 0;
    f.state.evm = [nativeEvent, { ...nativeEvent, head: otherWsId }];
    await expect((await f.create()).getAppended(wsId, 1n)).rejects.toThrow(/conflict|ambiguous/i);
  });
});

describe('native-only conflicting admissions', () => {
  it('rejects different native events at one workspace index', async () => {
    const f = fixture();
    f.nativeBlock.events.push(record({ ...nativeEvent, head: otherWsId }));
    const reader = await f.create();
    await expect(reader.getAppended(wsId, 1n)).rejects.toThrow(/conflict|ambiguous/i);
    await expect(reader.getAppendedRange(wsId, 0n, 2n)).rejects.toThrow(/conflict|ambiguous/i);
  });
});
