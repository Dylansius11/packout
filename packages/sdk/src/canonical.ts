export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export function canonicalJson(value: JsonValue): string {
  const ancestors = new Set<object>();
  function encode(value: unknown): string {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value))
        throw new TypeError('Canonical JSON requires safe integers.');
      return JSON.stringify(value);
    }
    if (typeof value !== 'object') throw new TypeError('Value is not canonical JSON.');
    if (ancestors.has(value)) throw new TypeError('Canonical JSON cannot contain cycles.');
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return `[${Array.from(value, encode).join(',')}]`;
      }
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Canonical JSON requires plain objects.');
      }
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode(object[key])}`)
        .join(',')}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  return encode(value);
}
