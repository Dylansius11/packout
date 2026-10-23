import { describe, expect, it } from 'vitest';
import { parseKeyInput, toBase64Url } from '../src/domain/key-input.ts';

const wsId = `0x${'ab'.repeat(32)}` as const;
const key = new Uint8Array(32).map((_, index) => index * 7);
const b64 = toBase64Url(key);

describe('key input', () => {
  it('accepts the raw key as saved in key.txt, with surrounding whitespace', () => {
    expect(parseKeyInput(`  ${b64}\n`)).toEqual({ ok: true, key, wsId: null });
  });

  it('accepts a full invite link and learns which workspace it belongs to', () => {
    const parsed = parseKeyInput(`https://old-app.example/join#ws=${wsId}&k=${b64}`);
    expect(parsed).toEqual({ ok: true, key, wsId });
  });

  it('accepts just the fragment of an invite link', () => {
    expect(parseKeyInput(`#ws=${wsId}&k=${b64}`)).toEqual({ ok: true, key, wsId });
  });

  it('explains an empty field', () => {
    const parsed = parseKeyInput('   ');
    expect(parsed.ok).toBe(false);
  });

  it('rejects a key that is not 32 bytes, raw or in a link', () => {
    const short = toBase64Url(new Uint8Array(31));
    for (const text of [short, `#ws=${wsId}&k=${short}`]) {
      const parsed = parseKeyInput(text);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.message).toMatch(/32-byte|43 characters/);
    }
  });

  it('rejects a padded or non-base64url key', () => {
    expect(parseKeyInput(`${b64}=`).ok).toBe(false);
    expect(parseKeyInput('+'.repeat(43)).ok).toBe(false);
  });

  it('names the problem when an invite link is cut off or has a bad workspace id', () => {
    const noKey = parseKeyInput(`https://x.example/join#ws=${wsId}`);
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.message).toMatch(/missing/);
    const badWs = parseKeyInput(`#ws=0x1234&k=${b64}`);
    expect(badWs.ok).toBe(false);
    if (!badWs.ok) expect(badWs.message).toMatch(/workspace id/);
  });
});
