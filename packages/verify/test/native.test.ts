import type { ApiPromise } from '@polkadot/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyBundle } from '../src/verify.ts';
import { close, listen, nativeFixture, nativeHash } from './native-fixture.ts';

let fixture = nativeFixture();
let rpc: string;
beforeEach(async () => {
  fixture = nativeFixture();
  rpc = await listen(fixture.server);
});
afterEach(async () => {
  await close(fixture.server);
});

describe('independent native admission proof', () => {
  it('verifies mixed EVM/native history and decrypts all operations', async () => {
    const report = await verifyBundle({
      bundle: fixture.bundle,
      key: fixture.key,
      rpc,
      native: {
        nativeApi: fixture.nativeApi as unknown as ApiPromise,
        blockHashes: [nativeHash],
        rpc: 'http://native.test',
      },
    });
    expect(report.ok).toBe(true);
    expect(report.steps.map((step) => step.status)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
    ]);
    expect(report.trust).toContain(rpc);
    expect(report.trust).toContain('http://native.test');
    expect(report.trust).toMatch(/not light-client/i);
    expect(JSON.stringify(report)).not.toContain('Private native history');
  });
  it('rejects equal-count EVM state whose stored head contradicts the native admission', async () => {
    fixture.state.workspaceHead = `0x${'99'.repeat(32)}`;
    const report = await verifyBundle({
      bundle: fixture.bundle,
      key: fixture.key,
      rpc,
      native: {
        nativeApi: fixture.nativeApi as unknown as ApiPromise,
        blockHashes: [nativeHash],
      },
    });
    expect(report.ok).toBe(false);
    expect(report.steps[3].status).toBe('fail');
    expect(report.steps[4].status).toBe('not checked');
    expect(report.steps[5].status).toBe('not checked');
  });
});
