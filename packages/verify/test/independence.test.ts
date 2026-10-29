import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const forbidden = /@packout\/(?:sdk|vendor-a|vendor-api|client-b)\b|(?:^|[/'".])(?:apps|sdk)\//m;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}

// The tests may use the SDK as a black-box oracle; the shipped CLI may not.
describe('independent verifier boundary', () => {
  it('ships no SDK or app source references or runtime dependencies', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(join(root, 'src'))) {
      if (forbidden.test(readFileSync(file, 'utf8'))) violations.push(relative(root, file));
    }
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      if (forbidden.test(JSON.stringify(manifest[section] ?? {}))) violations.push(section);
    }
    expect(violations).toEqual([]);
  });

  it('detects SDK imports, relative SDK paths and app imports', () => {
    for (const source of [
      "import { verifyBundle } from '@packout/sdk';",
      "import '../../sdk/src/index.ts';",
      "import '../../../apps/client-b/src/main.ts';",
      "await import('@packout/vendor-api');",
    ])
      expect(forbidden.test(source)).toBe(true);
  });
});
