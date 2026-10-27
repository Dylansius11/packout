import '@polkadot/api/augment';
import { Keyring } from '@polkadot/api';
import { cryptoWaitReady, mnemonicValidate } from '@polkadot/util-crypto';
import { z } from 'zod';

export const ACCOUNT_VARIABLES = [
  'SUCCESSION_W_MNEMONIC',
  'SUCCESSION_N_MNEMONIC',
  'SUCCESSION_BACKUP_1_MNEMONIC',
  'SUCCESSION_BACKUP_2_MNEMONIC',
  'SUCCESSION_BACKUP_3_MNEMONIC',
] as const;
export async function loadAccounts() {
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const pairs = ACCOUNT_VARIABLES.map((variable) => {
    const phrase = z.string().min(1).safeParse(process.env[variable]);
    if (!phrase.success || !mnemonicValidate(phrase.data))
      throw new Error(
        `Set a valid ${variable} in .env (run pnpm succession:keys for missing backup/inheritor keys).`,
      );
    return keyring.addFromMnemonic(phrase.data);
  });
  if (new Set(pairs.map((pair) => pair.address)).size !== 5)
    throw new Error('W, N and all three backups must be distinct accounts.');
  if (pairs[0].address !== '5D5Qw6HsJ7wK4APZF9TfqTSP5omBtLE1uF9YFgYyk1jLj9zE')
    throw new Error(
      'SUCCESSION_W_MNEMONIC does not derive the pinned dedicated workspace authority W.',
    );
  return {
    W: pairs[0],
    N: pairs[1],
    backups: pairs.slice(2),
    pairs,
    public: {
      W: pairs[0].publicKey,
      N: pairs[1].publicKey,
      backups: pairs.slice(2).map((pair) => pair.publicKey),
    },
  };
}
