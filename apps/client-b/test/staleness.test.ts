import { describe, expect, it } from 'vitest';
import { staleness } from '../src/domain/staleness.ts';

const head = `0x${'aa'.repeat(32)}` as const;
const other = `0x${'bb'.repeat(32)}` as const;

describe('refusing to write on a history that moved', () => {
  it('lets a write through when device and Portaldot agree', () => {
    expect(staleness({ count: 4, head }, { count: 4n, head })).toBeNull();
  });

  it('says how many newer operations Portaldot has', () => {
    const message = staleness({ count: 4, head }, { count: 7n, head: other });
    expect(message).toMatch(/\b3 operations\b/);
    expect(message).toMatch(/Nothing was written/);
  });

  it('refuses when the device holds operations Portaldot never admitted', () => {
    expect(staleness({ count: 5, head }, { count: 4n, head })).toMatch(/\b1 operation\b/);
  });

  it('refuses a different head at the same length', () => {
    expect(staleness({ count: 4, head }, { count: 4n, head: other })).toMatch(
      /different history head/,
    );
  });
});
