import { describe, expect, it } from 'vitest';
import { parseConfig, parseDeployment } from '../src/config.ts';

describe('vendor configuration trust boundary', () => {
  it('uses documented localhost defaults without requiring a private key', () => {
    expect(parseConfig({})).toMatchObject({
      PORT: 8787,
      DATABASE_PATH: 'data/vendor-api.sqlite',
      PACKOUT_NETWORK: 'localhost',
      BATCH_INTERVAL_MS: 3000,
      CORS_ORIGIN: 'http://localhost:5173',
    });
    expect(parseConfig({}).VENDOR_WRITER_PRIVATE_KEY).toBeUndefined();
  });
  it('requires the configured vendor key only on testnet and never echoes invalid values', () => {
    expect(() => parseConfig({ PACKOUT_NETWORK: 'portaldotTestnet' })).toThrow(
      /VENDOR_WRITER_PRIVATE_KEY/,
    );
    const invalid = 'invalid-value-must-not-be-echoed';
    let failure: unknown;
    try {
      parseConfig({ PACKOUT_NETWORK: 'portaldotTestnet', VENDOR_WRITER_PRIVATE_KEY: invalid });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(invalid);
  });
  it('ignores root testnet keys completely on localhost, including malformed values', () => {
    for (const key of ['root-testnet-key-is-not-used', `0x${'00'.repeat(32)}`]) {
      expect(
        parseConfig({ PACKOUT_NETWORK: 'localhost', VENDOR_WRITER_PRIVATE_KEY: key })
          .VENDOR_WRITER_PRIVATE_KEY,
      ).toBeUndefined();
      expect(
        parseConfig({ VENDOR_WRITER_PRIVATE_KEY: key }).VENDOR_WRITER_PRIVATE_KEY,
      ).toBeUndefined();
    }
  });
  it('rejects malformed ports, network names, intervals and URLs', () => {
    for (const config of [
      { PORT: '0' },
      { PORT: '65536' },
      { PORT: 'no' },
      { BATCH_INTERVAL_MS: '0' },
      { PACKOUT_NETWORK: 'mainnet' },
      { PORTALDOT_EVM_RPC: 'not a URL' },
      { CORS_ORIGIN: '*' },
    ])
      expect(() => parseConfig(config)).toThrow();
  });
  it('validates deployment records and pins them to the selected network', () => {
    const deployment = {
      network: 'localhost',
      chainId: 31337,
      address: `0x${'11'.repeat(20)}`,
      blockNumber: '1',
    };
    expect(parseDeployment(deployment, 'localhost')).toEqual(deployment);
    expect(() => parseDeployment(deployment, 'portaldotTestnet')).toThrow(/network/);
    expect(() => parseDeployment({ ...deployment, address: 'invalid' }, 'localhost')).toThrow(
      /deployment/i,
    );
    expect(() => parseDeployment({ ...deployment, chainId: 420420777 }, 'localhost')).toThrow(
      /chain/i,
    );
  });
});
