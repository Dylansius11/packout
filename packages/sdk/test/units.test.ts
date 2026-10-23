import { describe, expect, it } from 'vitest';
import { evmToNative, nativeToEvm } from '../src/index.ts';

describe('nativeToEvm', () => {
  it.each([
    [0n, 0n],
    [1n, 10_000n],
    [123n, 1_230_000n],
    [10n ** 14n, 10n ** 18n],
  ])('converts %s native planck to %s EVM wei exactly', (planck, wei) => {
    expect(nativeToEvm(planck)).toBe(wei);
  });
});

describe('evmToNative', () => {
  it.each([
    [0n, 0n],
    [10_000n, 1n],
    [1_230_000n, 123n],
    [10n ** 18n, 10n ** 14n],
  ])('converts %s EVM wei to %s native planck exactly', (wei, planck) => {
    expect(evmToNative(wei)).toBe(planck);
  });

  it.each([1n, 9_999n, 10_001n])('rejects %s wei instead of truncating native units', (wei) => {
    expect(() => evmToNative(wei)).toThrow(RangeError);
  });
});
