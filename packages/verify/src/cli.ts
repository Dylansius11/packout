#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { DEFAULT_RPC } from './chain.ts';
import { STEP_NAMES, verifyBundle } from './verify.ts';

const usage = 'Usage: packout-verify <bundle.json> [--key <file>] [--rpc <url>] [--json]';

async function main(): Promise<number> {
  let options: { positionals: string[]; values: { key?: string; rpc?: string; json?: boolean } };
  try {
    options = parseArgs({
      options: { key: { type: 'string' }, rpc: { type: 'string' }, json: { type: 'boolean' } },
      allowPositionals: true,
      strict: true,
    });
    if (options.positionals.length !== 1) throw new Error('Supply exactly one bundle file.');
    const url = new URL(options.values.rpc ?? DEFAULT_RPC);
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new Error('RPC must be an HTTP or HTTPS URL.');
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : 'Invalid arguments.'}\n${usage}`);
    return 2;
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
  const report = await verifyBundle({ bundle, key, keyError, rpc: options.values.rpc });
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
