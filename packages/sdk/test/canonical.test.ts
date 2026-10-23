import { describe, expect, it } from 'vitest';
import { canonicalJson, type JsonValue } from '../src/index.ts';

describe('canonicalJson', () => {
  it('sorts every object by UTF-16 keys regardless of insertion order', () => {
    const left = { z: [{ b: 2, a: 1 }], a: { y: true, x: null } };
    const right = { a: { x: null, y: true }, z: [{ a: 1, b: 2 }] };
    expect(canonicalJson(left)).toBe('{"a":{"x":null,"y":true},"z":[{"a":1,"b":2}]}');
    expect(new TextEncoder().encode(canonicalJson(left))).toEqual(
      new TextEncoder().encode(canonicalJson(right)),
    );
    expect(canonicalJson({ '2': 2, '10': 10, '\uE000': 1, '😀': 2 })).toBe(
      '{"10":10,"2":2,"😀":2,"\uE000":1}',
    );
  });

  it('preserves JSON primitives, escaping, and array order', () => {
    expect(canonicalJson([null, true, false, -0, -5, 'é\n"'])).toBe(
      '[null,true,false,0,-5,"é\\n\\""]',
    );
  });

  it.each([
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    undefined,
    { nested: undefined },
    [undefined],
    Array(1),
    new Date(),
    new Map(),
    1n,
    () => 1,
  ])('rejects noncanonical input %#', (value) => {
    expect(() => canonicalJson(value as JsonValue)).toThrow(TypeError);
  });

  it('rejects circular objects instead of silently dropping data', () => {
    const value: { self?: JsonValue } = {};
    value.self = value;
    expect(() => canonicalJson(value as JsonValue)).toThrow(TypeError);
  });
});
