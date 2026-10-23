import type { Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createOp,
  decodeOp,
  encodeOp,
  type Op,
  type OpBody,
  PackoutError,
} from '../src/index.ts';

const wsId: Hex = `0x${'11'.repeat(32)}`;
const opId: Hex = `0x${'22'.repeat(16)}`;
const author = { memberId: `0x${'33'.repeat(16)}` as Hex, name: 'Dina' };
const base = { wsId, opId, ts: 1761200000000, author };
const bodies: OpBody[] = [
  { type: 'issue.create', body: { title: 'Leave the vendor', description: 'Keep our history. é' } },
  { type: 'issue.setStatus', body: { issueId: opId, status: 'in_progress' } },
  { type: 'comment.add', body: { issueId: opId, text: 'Ready to restore.' } },
];
const issue: Op = { ...base, v: 1, type: 'issue.create', body: { title: 'Exit', description: '' } };
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe('journal operations', () => {
  it.each(bodies)('round-trips $type as canonical UTF-8', (body) => {
    const expected = { ...base, v: 1, ...body };
    const op = createOp({ ...base, ...body });
    expect(op).toEqual(expected);
    expect(new TextDecoder().decode(encodeOp(op))).toBe(canonicalJson(expected));
    expect(decodeOp(encodeOp(op))).toEqual(expected);
  });

  it('encodes identical ops independently of key insertion order', () => {
    const reversed: Op = {
      body: { description: '', title: 'Exit' },
      type: 'issue.create',
      author: { name: 'Dina', memberId: author.memberId },
      ts: base.ts,
      opId,
      wsId,
      v: 1,
    };
    expect(encodeOp(reversed)).toEqual(encodeOp(issue));
    expect(new TextDecoder().decode(encodeOp(issue))).toBe(
      `{"author":{"memberId":"${author.memberId}","name":"Dina"},"body":{"description":"","title":"Exit"},"opId":"${opId}","ts":1761200000000,"type":"issue.create","v":1,"wsId":"${wsId}"}`,
    );
  });

  it('generates fresh 16-byte op ids and defaults timestamps to the current time', () => {
    const before = Date.now();
    const first = createOp({ wsId, author, ...bodies[0] });
    const second = createOp({ wsId, author, ...bodies[0] });
    expect(first.opId).toMatch(/^0x[0-9a-f]{32}$/);
    expect(first.opId).not.toBe(second.opId);
    expect(first.ts).toBeGreaterThanOrEqual(before);
    expect(first.ts).toBeLessThanOrEqual(Date.now());
    expect(createOp({ ...base, ts: 0, ...bodies[0] }).ts).toBe(0);
  });

  it('reports unsupported op types explicitly', () => {
    expect(() => decodeOp(bytes({ ...issue, type: 'issue.delete' }))).toThrow(
      expect.objectContaining({ code: 'unknown-op-type' }),
    );
  });

  it.each([
    { ...issue, body: { title: 'x'.repeat(201), description: '' } },
    { ...issue, body: { title: '', description: '' } },
    { ...issue, body: { title: 'Exit', description: 'x'.repeat(5001) } },
    { ...issue, author: { ...author, name: '' } },
    { ...issue, author: { ...author, name: 'x'.repeat(65) } },
    { ...issue, author: { ...author, memberId: '0xab' } },
    { ...issue, opId: `0x${'AA'.repeat(16)}` },
    { ...issue, wsId: `0x${'11'.repeat(31)}` },
    { ...issue, ts: -1 },
    { ...issue, ts: 0.5 },
    { ...issue, ts: Number.MAX_SAFE_INTEGER + 1 },
    { ...issue, v: 2 },
    { ...issue, type: undefined },
    { ...issue, type: 1 },
    { ...issue, extra: true },
    { ...base, v: 1, type: 'issue.setStatus', body: { issueId: opId, status: 'closed' } },
    { ...base, v: 1, type: 'comment.add', body: { issueId: opId, text: '' } },
    { ...base, v: 1, type: 'comment.add', body: { issueId: opId, text: 'x'.repeat(5001) } },
    { ...base, v: 1, type: 'comment.add', body: { issueId: '0x22', text: 'Ready' } },
    null,
    [],
  ])('rejects invalid shape %# with a typed error', (value) => {
    expect(() => decodeOp(bytes(value))).toThrow(expect.objectContaining({ code: 'invalid-op' }));
  });

  it('validates ops before creating or encoding them', () => {
    const body = { title: 'x'.repeat(201), description: '' };
    expect(() => createOp({ ...base, type: 'issue.create', body })).toThrow(PackoutError);
    expect(() => encodeOp({ ...issue, body })).toThrow(
      expect.objectContaining({ code: 'invalid-op' }),
    );
  });

  it('accepts exact field limits without changing their contents', () => {
    const op = createOp({
      ...base,
      author: { ...author, name: 'x'.repeat(64) },
      type: 'issue.create',
      body: { title: 'x'.repeat(200), description: 'x'.repeat(5000) },
    });
    expect(decodeOp(encodeOp(op))).toEqual(op);
    const comment = createOp({
      ...base,
      type: 'comment.add',
      body: { issueId: opId, text: 'x'.repeat(5000) },
    });
    expect(decodeOp(encodeOp(comment))).toEqual(comment);
  });

  it.each(['{', 'null', '"not an op"'])('rejects invalid JSON operation %s', (text) => {
    expect(() => decodeOp(new TextEncoder().encode(text))).toThrow(
      expect.objectContaining({ code: 'invalid-op' }),
    );
  });

  it('rejects invalid UTF-8 instead of accepting replacement characters', () => {
    const prefix = new TextEncoder().encode(JSON.stringify(issue).replace('Exit', '\uFFFD'));
    const index = prefix.indexOf(0xef);
    prefix[index] = 0xff;
    expect(() => decodeOp(prefix)).toThrow(expect.objectContaining({ code: 'invalid-op' }));
  });
});
