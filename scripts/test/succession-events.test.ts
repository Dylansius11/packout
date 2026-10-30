import type { ChainReader } from '@packout/sdk';
import { describe, expect, it } from 'vitest';
import { decodeNativeAppends, successionReader } from '../lib/succession/events.ts';

const registry = '0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0';
const wsId = '0xb74ce764f52242e4c97c2bcb179777324a02883826fb436c14e3680c098ee48f';
// Actual finalized ContractEmitted event from block 248295; eth_getLogs returned [].
const emitted = {
  section: 'revive',
  method: 'ContractEmitted',
  data: [
    '0xa76ae793b3a648b87f512aacbf7c4ce2eeac61e0',
    '0x000000000000000000000000000000000000000000000000000000000000000092702755c70f29e4241a74acde9f2e6f8e9b9ee530ced34dfede4feceeb53238fe7a9c7db419f40f8b07a7ae55e6f56e5fba9ddb4fdc60536369f1d527e2e357',
    [
      '0xf8c557326949317cd7769ba05fb911f13c76dbcb6883b4a38bee487cb1c31b47',
      wsId,
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000002d313fc3e31a90b4a23f0e4b15a7c37817d70dd1',
    ],
  ],
};
const hash = '0x1a62aea703389efb9248dd2a41c2c329df6c58fc88a8d70fe547527dc76cb21f';

describe('native succession history', () => {
  it('decodes the native append omitted from Ethereum RPC history', () => {
    expect(decodeNativeAppends(registry, [emitted], 248295n, hash)).toEqual([
      {
        wsId,
        index: 1n,
        author: expect.stringMatching(/^0x2d313fc3e31a90b4a23f0e4b15a7c37817d70dd1$/i),
        epoch: 0,
        digest: '0x92702755c70f29e4241a74acde9f2e6f8e9b9ee530ced34dfede4feceeb53238',
        head: '0xfe7a9c7db419f40f8b07a7ae55e6f56e5fba9ddb4fdc60536369f1d527e2e357',
        blockNumber: 248295n,
        txHash: hash,
      },
    ]);
  });

  it('finds native history by workspace and index when the EVM reader has no log', async () => {
    const base: ChainReader = {
      chainId: 420420777,
      registry,
      getWorkspace: async () => null,
      getAppended: async () => null,
    };
    const reader = successionReader(base, decodeNativeAppends(registry, [emitted], 248295n, hash));
    expect(await reader.getAppended(wsId, 1n)).toMatchObject({
      digest: '0x92702755c70f29e4241a74acde9f2e6f8e9b9ee530ced34dfede4feceeb53238',
      index: 1n,
    });
    expect(await reader.getAppended(wsId, 0n)).toBeNull();
    expect(await reader.getAppended(`0x${'11'.repeat(32)}`, 1n)).toBeNull();
  });

  it('refuses ambiguous native references instead of choosing a convenient history', async () => {
    const base: ChainReader = {
      chainId: 420420777,
      registry,
      getWorkspace: async () => null,
      getAppended: async () => null,
    };
    const native = decodeNativeAppends(registry, [emitted], 248295n, hash);
    await expect(
      successionReader(base, [...native, ...native]).getAppended(wsId, 1n),
    ).rejects.toThrow('Conflicting');
  });

  it('does not accept another contract or a non-append event as workspace history', () => {
    expect(
      decodeNativeAppends(
        registry,
        [
          {
            ...emitted,
            data: ['0x0000000000000000000000000000000000000001', ...emitted.data.slice(1)],
          },
          { section: 'system', method: 'ExtrinsicSuccess', data: [] },
        ],
        248295n,
        hash,
      ),
    ).toEqual([]);
  });

  it('refuses a malformed matching Appended log instead of dropping proof', () => {
    expect(() =>
      decodeNativeAppends(
        registry,
        [{ ...emitted, data: [registry, '0x', emitted.data[2]] }],
        248295n,
        hash,
      ),
    ).toThrow();
  });
});
