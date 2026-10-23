import type { Address, Hex } from 'viem';
import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
    DATABASE_PATH: z.string().min(1).default('data/vendor-api.sqlite'),
    PACKOUT_DEPLOYMENTS_DIR: z.string().min(1).optional(),
    LOCAL_RPC_URL: z.url({ protocol: /^https?$/ }).default('http://127.0.0.1:8545'),
    PACKOUT_NETWORK: z.enum(['localhost', 'portaldotTestnet']).default('localhost'),
    PORTALDOT_EVM_RPC: z
      .url({ protocol: /^https?$/ })
      .default('https://test-evm-rpc-v3.portaldot.dev'),
    VENDOR_WRITER_PRIVATE_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .transform((value): Hex => value as Hex)
        .optional(),
    ),
    CORS_ORIGIN: z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),
    BATCH_INTERVAL_MS: z.coerce.number().int().min(1).max(2_147_483_647).default(3000),
  })
  .superRefine((config, context) => {
    if (config.PACKOUT_NETWORK === 'portaldotTestnet' && !config.VENDOR_WRITER_PRIVATE_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['VENDOR_WRITER_PRIVATE_KEY'],
        message: 'required on testnet',
      });
    }
  });

export type VendorConfig = z.infer<typeof envSchema>;
export function parseConfig(value: unknown): VendorConfig {
  // A root .env testnet key must never select or block the localhost writer.
  const input =
    value &&
    typeof value === 'object' &&
    (!('PACKOUT_NETWORK' in value) ||
      value.PACKOUT_NETWORK === undefined ||
      value.PACKOUT_NETWORK === 'localhost')
      ? { ...value, VENDOR_WRITER_PRIVATE_KEY: undefined }
      : value;
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(`Set a valid ${result.error.issues[0].path.join('.')} in the environment.`);
  return result.data;
}

const deploymentSchema = z.object({
  network: z.enum(['localhost', 'portaldotTestnet']),
  chainId: z.int().positive(),
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((value): Address => value as Address),
  blockNumber: z.string().regex(/^\d+$/),
});
export type Deployment = z.infer<typeof deploymentSchema>;
export function parseDeployment(
  value: unknown,
  network: VendorConfig['PACKOUT_NETWORK'],
): Deployment {
  const result = deploymentSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      'Invalid registry deployment record. Run the selected network deploy command first.',
    );
  if (result.data.network !== network)
    throw new Error('Registry deployment network does not match PACKOUT_NETWORK.');
  const chainId = network === 'localhost' ? 31337 : 420420777;
  if (result.data.chainId !== chainId)
    throw new Error('Registry deployment chain id does not match PACKOUT_NETWORK.');
  return result.data;
}
