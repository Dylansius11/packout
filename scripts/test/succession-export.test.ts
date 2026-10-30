import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseBundle } from '@packout/sdk';
import { describe, expect, it } from 'vitest';
import { exportSuccessionBundle } from '../lib/succession/workspace.ts';

// Public artifacts must never serialize the private checkpoint's owner key.
describe('Succession public export', () => {
  it('produces a strict bundle and native hints without leaking private checkpoint fields', async () => {
    const root = new URL('../../out/export-tests/', import.meta.url);
    await mkdir(root, { recursive: true });
    const path = await mkdtemp(fileURLToPath(new URL('case-', root)));
    const directory = pathToFileURL(`${path}/`);
    const privateMarker = 'private-checkpoint-must-not-be-published';
    const state = {
      registry: '0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0',
      wsId: `0x${'11'.repeat(32)}` as `0x${string}`,
      envelopes: [],
      nativeBlocks: [`0x${'22'.repeat(32)}` as `0x${string}`],
      key: privateMarker,
    };
    try {
      await exportSuccessionBundle(state, 248509, directory);
      const bundle = await readFile(new URL('bundle.json', directory), 'utf8');
      const hints = await readFile(new URL('native-blocks.json', directory), 'utf8');
      expect(parseBundle(JSON.parse(bundle)).checkpoint.count).toBe(0);
      expect(JSON.parse(hints)).toEqual([`0x${'22'.repeat(32)}`]);
      expect(bundle + hints).not.toContain(privateMarker);
      expect(JSON.parse(bundle)).not.toHaveProperty('key');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
