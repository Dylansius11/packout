import { parseOptions } from './lib/succession/model.ts';
import { runSuccession } from './lib/succession/run.ts';

try {
  const options = parseOptions(process.argv.slice(2));
  await runSuccession(options.spike, options.delayBlocks);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Succession failed; inspect evidence before retrying.',
  );
  process.exitCode = 1;
}
