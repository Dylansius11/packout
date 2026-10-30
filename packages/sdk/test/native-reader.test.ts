import { describe, expect, it } from 'vitest';
import { createNativeRegistryReader } from '../src/native.ts';
import {
  evmTxHash,
  extrinsicHash,
  nativeEvent,
  fixture as nativeFixture,
  otherWsId,
  wsId,
} from './native-fixture.ts';

const fixture = () => nativeFixture(createNativeRegistryReader);

describe('native RegistryReader', () => {
  it('merges node-proven native and EVM history in index order', async () => {
    const f = fixture();
    f.state.evm = [
      { ...nativeEvent, index: 2n, blockNumber: 248296n, txHash: evmTxHash },
      { ...nativeEvent, index: 0n, blockNumber: 248294n, txHash: evmTxHash },
    ];
    const reader = await f.create();
    expect(
      (await reader.getAppendedRange(wsId, 0n, 2n)).map(({ index, txHash }) => [index, txHash]),
    ).toEqual([
      [0n, evmTxHash],
      [1n, extrinsicHash],
      [2n, evmTxHash],
    ]);
    expect(await reader.getAppended(wsId, 1n)).toMatchObject({
      ...nativeEvent,
      author: expect.stringMatching(/^0x2d313fc3e31a90b4a23f0e4b15a7c37817d70dd1$/i),
    });
    expect(await reader.getAppendedRange(wsId, 2n, 1n)).toEqual([]);
  });

  it('filters point and range reads by workspace and index', async () => {
    const f = fixture();
    const reader = await f.create();
    expect(await reader.getAppended(otherWsId, 1n)).toBeNull();
    expect(await reader.getAppended(wsId, 0n)).toBeNull();
    expect(await reader.getAppendedRange(otherWsId, 0n, 2n)).toEqual([]);
    expect(await reader.getAppendedRange(wsId, 2n, 3n)).toEqual([]);
  });
});
