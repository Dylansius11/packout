import { bytesToHex, type Hex } from 'viem';
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
  ws: z.string().regex(/^0x[0-9a-f]{64}$/, 'The workspace id is not 32 bytes of lowercase hex.'),
  k: z.string().min(1, 'The key is missing.'),
});

export type Invite = { wsId: Hex; key: Uint8Array };
export type InviteParse = { ok: true; invite: Invite } | { ok: false; message: string };

/** Reads `#ws=<wsId>&k=<base64url key>`; the fragment is the only place the key travels. */
export function parseInviteFragment(hash: string): InviteParse {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const parsed = fragmentSchema.safeParse({ ws: params.get('ws') ?? '', k: params.get('k') ?? '' });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === 'k' ? 'key' : 'workspace id';
    const detail =
      params.has('ws') || params.has('k') ? issue?.message : `The ${field} is missing.`;
    return { ok: false, message: detail ?? 'This invite link is not valid.' };
  }
  const key = fromBase64Url(parsed.data.k);
  if (key === null || key.length !== KEY_BYTES) {
    return {
      ok: false,
      message: 'The key in this invite link is damaged: it is not a 32-byte key.',
    };
  }
  return { ok: true, invite: { wsId: parsed.data.ws as Hex, key } };
}

export function buildInviteUrl(origin: string, wsId: Hex, key: Uint8Array): string {
  return `${origin}/join#ws=${wsId}&k=${toBase64Url(key)}`;
}

export function randomMemberId(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export function keyFromBase64Url(value: string): Uint8Array {
  const bytes = fromBase64Url(value);
  if (bytes === null || bytes.length !== KEY_BYTES) {
    throw new Error('The workspace key stored on this device is damaged.');
  }
  return bytes;
}
