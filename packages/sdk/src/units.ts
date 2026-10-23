export const NATIVE_DECIMALS = 14;
export const EVM_DECIMALS = 18;
export const NATIVE_TO_ETH_RATIO = 10_000n;

export function nativeToEvm(planck: bigint): bigint {
  return planck * NATIVE_TO_ETH_RATIO;
}

export function evmToNative(wei: bigint): bigint {
  if (wei % NATIVE_TO_ETH_RATIO !== 0n) {
    throw new RangeError('EVM wei must be an exact multiple of 10000 to convert to native planck');
  }
  return wei / NATIVE_TO_ETH_RATIO;
}
