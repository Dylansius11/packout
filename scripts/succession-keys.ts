import { appendFile, readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { Keyring } from '@polkadot/api';
import { cryptoWaitReady, mnemonicGenerate, mnemonicValidate } from '@polkadot/util-crypto';
import { ACCOUNT_VARIABLES } from './lib/succession/accounts.ts';

const envFile = new URL('../.env', import.meta.url);
try {
  await cryptoWaitReady();
  const existing = parseEnv(await readFile(envFile, 'utf8'));
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
  for (const variable of ACCOUNT_VARIABLES.slice(1)) {
    let phrase = existing[variable];
    if (!phrase) {
      phrase = mnemonicGenerate(24);
      await appendFile(envFile, `\n${variable}=${phrase}\n`, { mode: 0o600 });
    }
    if (!mnemonicValidate(phrase))
      throw new Error(`Existing ${variable} is invalid; it was not replaced.`);
    console.log(keyring.addFromMnemonic(phrase).address);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Account generation failed.');
  process.exitCode = 1;
}
