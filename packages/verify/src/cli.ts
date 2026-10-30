#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { DEFAULT_RPC } from './chain.ts';
import { DEFAULT_NATIVE_RPC, type NativeOptions, nativeBlocksSchema } from './native.ts';
import { STEP_NAMES, verifyBundle } from './verify.ts';

const usage =
  'Usage: packout-verify <bundle.json> [--key <file>] [--rpc <http(s) URL>] [--native-blocks <file> [--native-rpc <http(s) or ws(s) URL>]] [--json]';

async function main(): Promise<number> {
  let options: {
    positionals: string[];
    values: {
      key?: string;
      rpc?: string;
      json?: boolean;
      'native-blocks'?: string;
      'native-rpc'?: string;
    };
  };
  try {
    options = parseArgs({
      options: {
        key: { type: 'string' },
        rpc: { type: 'string' },
        json: { type: 'boolean' },
        'native-blocks': { type: 'string' },
        'native-rpc': { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
    if (options.positionals.length !== 1) throw new Error('Supply exactly one bundle file.');
    if (options.values['native-rpc'] !== undefined && options.values['native-blocks'] === undefined)
      throw new Error('--native-rpc requires --native-blocks.');
    const evmUrl = new URL(options.values.rpc ?? DEFAULT_RPC);
    if (evmUrl.protocol !== 'https:' && evmUrl.protocol !== 'http:')
      throw new Error('EVM RPC must be an HTTP or HTTPS URL.');
    const nativeUrl = new URL(options.values['native-rpc'] ?? DEFAULT_NATIVE_RPC);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(nativeUrl.protocol))
      throw new Error('Native RPC must be an HTTP, HTTPS, WS or WSS URL.');
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : 'Invalid arguments.'}\n${usage}`);
    return 2;
  }
  let native: NativeOptions | undefined;
  if (options.values['native-blocks'] !== undefined) {
    try {
      const contents = await readFile(options.values['native-blocks'], 'utf8');
      const parsed = nativeBlocksSchema.safeParse(JSON.parse(contents));
      if (!parsed.success) throw new Error('Invalid sidecar');
      native = {
        blockHashes: parsed.data,
        rpc: options.values['native-rpc'] ?? DEFAULT_NATIVE_RPC,
      };
    } catch {
      console.error(
        `The native block sidecar must be readable JSON containing an array of at most 4096 block hashes (0x + 64 hex digits).\\n${usage}`,
      );
      return 2;
    }
  }
  let bundle: unknown;
  let bundleError: string | undefined;
  try {
    bundle = await readFile(options.positionals[0], 'utf8');
  } catch {
    bundleError = 'The bundle file could not be read; check its path and permissions.';
  }

  let key: Uint8Array | undefined;
  let keyError: string | undefined;
  if (options.values.key !== undefined) {
    try {
      const encoded = (await readFile(options.values.key, 'utf8')).trim();
      // The invite format specifies base64url. Require canonical, unpadded 32-byte encoding.
      if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error('encoding');
      key = Buffer.from(encoded, 'base64url');
      if (key.length !== 32 || Buffer.from(key).toString('base64url') !== encoded)
        throw new Error('encoding');
    } catch {
      key = undefined;
      keyError =
        'The key file must be readable and contain a 32-byte workspace key encoded as unpadded base64url.';
    }
  }
  const report = await verifyBundle({ bundle, key, keyError, rpc: options.values.rpc, native });
  if (bundleError) report.steps[0].message = bundleError;
  if (options.values.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.trust);
    for (const step of report.steps)
      console.log(`${step.status.toUpperCase()} ${STEP_NAMES[step.id]}: ${step.message}`);
    console.log(report.ok ? 'Verification succeeded.' : 'Verification failed.');
  }
  key?.fill(0);
  return report.ok ? 0 : 1;
}

process.exitCode = await main();
