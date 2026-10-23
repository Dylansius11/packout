import { describe, expect, it } from 'vitest';
import { buildInviteUrl, parseInviteFragment, toBase64Url } from '../src/domain/invite.ts';

const wsId = `0x${'ab'.repeat(32)}` as const;
const key = new Uint8Array(32).map((_, index) => index * 7);

describe('invite link fragment', () => {
  it('round-trips the workspace id and the key an owner shares', () => {
    const url = new URL(buildInviteUrl('https://vendor-a.example', wsId, key));
    expect(url.pathname).toBe('/join');
    const parsed = parseInviteFragment(url.hash);
    expect(parsed).toEqual({ ok: true, invite: { wsId, key } });
  });

  it('puts the key only after the #, which browsers never send to a server', () => {
    const url = new URL(buildInviteUrl('https://vendor-a.example', wsId, key));
    expect(url.search).toBe('');
    expect(`${url.origin}${url.pathname}`).not.toContain(toBase64Url(key));
  });

  it('rejects a key that is not 32 bytes', () => {
    const shortKey = toBase64Url(new Uint8Array(31));
    const parsed = parseInviteFragment(`#ws=${wsId}&k=${shortKey}`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/32-byte key/);
  });

  it('rejects characters that are not base64url and padded keys', () => {
    expect(parseInviteFragment(`#ws=${wsId}&k=${'+'.repeat(43)}`).ok).toBe(false);
    expect(parseInviteFragment(`#ws=${wsId}&k=${toBase64Url(key)}=`).ok).toBe(false);
  });

  it('rejects a malformed workspace id and says which part is wrong', () => {
    const parsed = parseInviteFragment(`#ws=0x1234&k=${toBase64Url(key)}`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/workspace id/);
  });

  it('names the missing part when the fragment is empty or half there', () => {
    const empty = parseInviteFragment('');
    expect(empty.ok).toBe(false);
    const noKey = parseInviteFragment(`#ws=${wsId}`);
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.message).toMatch(/key is missing/);
  });
});
