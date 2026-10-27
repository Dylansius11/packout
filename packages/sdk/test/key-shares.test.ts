import { describe, expect, it } from 'vitest';
import {
  combineWorkspaceKey,
  generateWorkspaceKey,
  PackoutError,
  splitWorkspaceKey,
} from '../src/index.ts';

function backup(shares: Uint8Array[], index: number): Uint8Array {
  const share = shares[index];
  if (!share) throw new Error(`Split did not produce backup ${index}.`);
  return share;
}

describe('workspace key recovery shares', () => {
  it('recovers the exact workspace key with any two backups or all three', async () => {
    const key = generateWorkspaceKey();
    const shares = await splitWorkspaceKey(key);
    expect(shares).toHaveLength(3);
    for (const indices of [
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
      [0, 1, 2],
    ]) {
      expect(await combineWorkspaceKey(indices.map((index) => backup(shares, index)))).toEqual(key);
    }
  });

  it('refuses one backup and duplicate backups, including copied shares', async () => {
    const shares = await splitWorkspaceKey(generateWorkspaceKey());
    const share = backup(shares, 0);
    await expect(combineWorkspaceKey([share])).rejects.toThrow(PackoutError);
    await expect(combineWorkspaceKey([share, share.slice()])).rejects.toThrow(/distinct/i);
  });

  it('refuses shares from different workspace keys', async () => {
    const first = await splitWorkspaceKey(generateWorkspaceKey());
    const second = await splitWorkspaceKey(generateWorkspaceKey());
    await expect(combineWorkspaceKey([backup(first, 0), backup(second, 1)])).rejects.toThrow(
      /different|match/i,
    );
  });

  it('refuses altered share payloads, commitments and coordinates', async () => {
    const shares = await splitWorkspaceKey(generateWorkspaceKey());
    for (const offset of [1, 17, 48, 49]) {
      const damaged = backup(shares, 0).slice();
      damaged[offset] = (damaged[offset] ?? 0) ^ 1;
      await expect(combineWorkspaceKey([damaged, backup(shares, 1)])).rejects.toThrow(PackoutError);
    }
    const damaged = backup(shares, 2).slice();
    damaged[17] = (damaged[17] ?? 0) ^ 1;
    await expect(
      combineWorkspaceKey([backup(shares, 0), backup(shares, 1), damaged]),
    ).rejects.toThrow(PackoutError);
  });

  it('refuses truncated shares, unsupported versions and zero coordinates', async () => {
    const shares = await splitWorkspaceKey(generateWorkspaceKey());
    const version = backup(shares, 0).slice();
    version[0] = 255;
    const coordinate = backup(shares, 0).slice();
    coordinate[coordinate.length - 1] = 0;
    for (const invalid of [new Uint8Array(), backup(shares, 0).slice(1), version, coordinate]) {
      await expect(combineWorkspaceKey([invalid, backup(shares, 1)])).rejects.toThrow(PackoutError);
    }
  });

  it.each([0, 16, 31, 33, 64])('refuses a %i-byte workspace key', async (length) => {
    await expect(splitWorkspaceKey(new Uint8Array(length))).rejects.toThrow(/32 bytes/i);
  });
});
