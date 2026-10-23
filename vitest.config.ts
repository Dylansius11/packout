import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.{test,spec}.ts',
      'apps/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.{test,spec}.ts',
    ],
    exclude: [...configDefaults.exclude, 'contracts/**', 'e2e/**', 'scratch/**'],
  },
});
