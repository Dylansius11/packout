import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createBundle, JOURNAL_SCHEMA_ID } from '@packout/sdk';
import { z } from 'zod';

const stateFile = new URL('../../../out/succession/workspace.json', import.meta.url);
const hex32 = z
  .string()
  .regex(/^0x[\da-fA-F]{64}$/)
  .transform((value): `0x${string}` => value as `0x${string}`);
const stateSchema = z.object({
  registry: z.string().regex(/^0x[\da-fA-F]{40}$/),
  wsId: hex32,
  key: z.string().regex(/^[\w-]+$/),
  envelopes: z.array(
    z
      .string()
      .regex(/^0x(?:[\da-fA-F]{2})+$/)
      .transform((value): `0x${string}` => value as `0x${string}`),
  ),
  nativeBlocks: z.array(hex32),
});
export interface SavedWorkspace {
  registry: string;
  wsId: `0x${string}`;
  key: Uint8Array;
  envelopes: `0x${string}`[];
  nativeBlocks: `0x${string}`[];
}
export async function loadWorkspace(): Promise<SavedWorkspace | undefined> {
  let text: string;
  try {
    text = await readFile(stateFile, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw new Error(
      'Cannot read saved succession workspace; refusing to create another workspace.',
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      'Saved succession workspace is not valid JSON; no private file content is printed.',
    );
  }
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('Saved succession workspace is invalid; refusing to create another workspace.');
  const key = new Uint8Array(Buffer.from(parsed.data.key, 'base64url'));
  if (key.length !== 32) throw new Error('Saved succession workspace key has invalid length.');
  return { ...parsed.data, key };
}
export async function saveWorkspace(state: SavedWorkspace) {
  await mkdir(new URL('.', stateFile), { recursive: true });
  await writeFile(
    stateFile,
    `${JSON.stringify({ ...state, key: Buffer.from(state.key).toString('base64url') })}\n`,
    { mode: 0o600 },
  );
  await chmod(stateFile, 0o600);
  console.log(
    'Workspace ciphertext and owner key saved separately from public evidence in gitignored out/succession/workspace.json (mode 0600 where supported; restrict Windows ACLs). Never publish this private rehearsal file.',
  );
}

export async function exportSuccessionBundle(
  state: Pick<SavedWorkspace, 'registry' | 'wsId' | 'envelopes' | 'nativeBlocks'>,
  blockNumber: number,
  directory: URL,
) {
  const bundle = createBundle({
    chainId: 420420777,
    registry: state.registry as `0x${string}`,
    wsId: state.wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes: state.envelopes,
    checkpoint: { blockNumber },
  });
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('bundle.json', directory), `${JSON.stringify(bundle, null, 2)}\n`);
  await writeFile(
    new URL('native-blocks.json', directory),
    `${JSON.stringify(state.nativeBlocks, null, 2)}\n`,
  );
  console.log(
    `Public bundle and native-blocks.json exported to ${directory.pathname}; key remains separate in the private rehearsal checkpoint.`,
  );
}
