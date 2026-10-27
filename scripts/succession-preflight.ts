import { parseOptions } from './lib/succession/model.ts';
import { preflight } from './lib/succession/preflight.ts';

try {
  const result = await preflight(parseOptions(process.argv.slice(2)).delayBlocks);
  await result.api.disconnect();
  if (!result.ready) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Succession preflight failed.');
  process.exitCode = 1;
}
