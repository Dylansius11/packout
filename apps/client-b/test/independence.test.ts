import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const IGNORED_DIRS = new Set(['node_modules', 'dist']);
const SKIPPED_FILES = new Set(['independence.test.ts']);

// Client B must have no code path to the vendor it replaces. The first pattern also catches
// relative paths such as `../../vendor-a/src/...`, which `apps/vendor-a` alone would miss.
const FORBIDDEN = [
  { pattern: /vendor-(?:a|api)\b/, why: 'refers to the vendor-a or vendor-api app or package' },
  { pattern: /VITE_VENDOR_API_URL/, why: 'reads the vendor API URL variable' },
  { pattern: /:8787/, why: "mentions the vendor API's port" },
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return IGNORED_DIRS.has(entry.name) ? [] : sourceFiles(join(directory, entry.name));
    }
    return SKIPPED_FILES.has(entry.name) ? [] : [join(directory, entry.name)];
  });
}

describe('Client B independence', () => {
  it('has no import, dependency, setting or port that leads to Vendor A or its API', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, 'utf8');
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(text)) violations.push(`${relative(root, file)}: ${why}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
