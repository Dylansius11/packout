import type { Hex } from 'viem';
import { z } from 'zod';

const KEY_BYTES = 32;

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Returns null for anything that is not canonical unpadded base64url. */
export function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded =
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return toBase64Url(bytes) === value ? bytes : null;
}

const fragmentSchema = z.object({
  ws: z
    .string()
    .regex(/^0x[0-9a-f]{64}$/, 'The workspace id in this link is not 32 bytes of lowercase hex.'),
  k: z.string().min(1, 'The key in this link is missing.'),
});

export type KeyInput =
  | { ok: true; key: Uint8Array; wsId: Hex | null }
  | { ok: false; message: string };

function keyFromBase64Url(value: string): Uint8Array | null {
  const bytes = fromBase64Url(value);
  return bytes !== null && bytes.length === KEY_BYTES ? bytes : null;
}

/**
 * Accepts what an owner actually has: the raw base64url key (for example the contents of `key.txt`)
 * or a full invite link `https://…/join#ws=<wsId>&k=<key>`. A link also names the workspace, so
 * the caller can refuse a bundle that belongs to a different one.
 */
export function parseKeyInput(text: string): KeyInput {
  const value = text.trim();
  if (value === '') return { ok: false, message: 'Paste the workspace key or the invite link.' };

  const hashStart = value.indexOf('#');
  const looksLikeLink = hashStart !== -1 || value.includes('ws=') || value.includes('://');
  if (!looksLikeLink) {
    const key = keyFromBase64Url(value);
    return key
      ? { ok: true, key, wsId: null }
      : {
          ok: false,
          message:
            'This is not a workspace key: it must be the 32-byte key in base64url, 43 characters of letters, digits, - and _.',
        };
  }

  const params = new URLSearchParams(hashStart === -1 ? value : value.slice(hashStart + 1));
  const parsed = fragmentSchema.safeParse({ ws: params.get('ws') ?? '', k: params.get('k') ?? '' });
  if (!parsed.success) {
    const missing = !params.has('ws') || !params.has('k');
    return {
      ok: false,
      message: missing
        ? 'This link is missing its #ws=…&k=… part. Paste the whole invite link, including everything after the #.'
        : (parsed.error.issues[0]?.message ?? 'This invite link is not valid.'),
    };
  }
  const key = keyFromBase64Url(parsed.data.k);
  if (!key) {
    return { ok: false, message: 'The key in this link is damaged: it is not a 32-byte key.' };
  }
  return { ok: true, key, wsId: parsed.data.ws as Hex };
}
