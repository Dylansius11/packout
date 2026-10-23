import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Address, Hex } from 'viem';
import { z } from 'zod';

export type DemoNetwork = 'portaldotTestnet' | 'localhost';

export function parseNetwork(args: string[]): DemoNetwork {
  if (args.length === 0) return 'portaldotTestnet';
  if (
    args.length === 2 &&
    args[0] === '--network' &&
    (args[1] === 'portaldotTestnet' || args[1] === 'localhost')
  )
    return args[1];
  throw new Error('Usage: demo-checkin.ts --network portaldotTestnet|localhost');
}

const deploymentSchema = z.object({
  network: z.enum(['portaldotTestnet', 'localhost']),
  chainId: z.int().positive(),
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((value): Address => value as Address),
  blockNumber: z.string().regex(/^\d+$/),
});
export type DemoDeployment = z.infer<typeof deploymentSchema>;

export function parseDeployment(value: unknown, network: DemoNetwork): DemoDeployment {
  const result = deploymentSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Deployment file has a missing or invalid ${result.error.issues[0].path.join('.')}. Run the ${network} deploy command first.`,
    );
  }
  if (result.data.network !== network)
    throw new Error('Deployment network does not match the selected network.');
  return result.data;
}

const privateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((value): Hex => value as Hex);
const envSchema = z.object({
  PORTALDOT_EVM_RPC: z.url().default('https://test-evm-rpc-v3.portaldot.dev'),
  DEPLOYER_PRIVATE_KEY: privateKey,
  VENDOR_WRITER_PRIVATE_KEY: privateKey,
});

export function parseTestnetEnv(value: unknown) {
  const result = envSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Set a valid ${result.error.issues[0].path.join('.')} in the root .env file. No transaction was sent.`,
    );
  }
  return result.data;
}

const localEnvSchema = z.object({
  LOCAL_RPC_URL: z.url({ protocol: /^https?$/ }).default('http://127.0.0.1:8545'),
  PACKOUT_DEPLOYMENTS_DIR: z.string().min(1).optional(),
});
export function parseLocalEnv(value: unknown): z.infer<typeof localEnvSchema> {
  const result = localEnvSchema.safeParse(value);
  if (!result.success)
    throw new Error(`Set a valid ${result.error.issues[0].path.join('.')} in the environment.`);
  return result.data;
}

export function mappedNativeAddress(address: Address): string {
  // AutoMap v3: SS58 prefix 42 over H160 followed by twelve 0xEE bytes.
  const payload = Buffer.concat([
    Buffer.from([42]),
    Buffer.from(address.slice(2), 'hex'),
    Buffer.alloc(12, 0xee),
  ]);
  const checksum = createHash('blake2b512')
    .update('SS58PRE')
    .update(payload)
    .digest()
    .subarray(0, 2);
  let value = BigInt(`0x${Buffer.concat([payload, checksum]).toString('hex')}`);
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let encoded = '';
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return encoded;
}

export function fundingMessage(role: string, address: Address, network: DemoNetwork): string {
  const mapped =
    network === 'portaldotTestnet'
      ? ` Fund mapped native address ${mappedNativeAddress(address)} (INTEGRATIONS.md section 2).`
      : '';
  return `The ${role} account ${address} has zero balance. Fund it before continuing.${mapped}`;
}

export async function waitForFinalized(
  client: { getBlock(input: { blockTag: 'finalized' }): Promise<{ number: bigint | null }> },
  blockNumber: bigint,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<bigint> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const finalized = await client.getBlock({ blockTag: 'finalized' });
    if (finalized.number !== null && finalized.number >= blockNumber) return finalized.number;
    if (Date.now() >= deadline) {
      throw new Error(
        `Transaction in block ${blockNumber} is not finalized: timeout after ${timeoutMs / 1000} seconds. It may finalize later; check the printed transaction hash before running again.`,
      );
    }
    await delay(Math.min(options.pollMs ?? 1000, Math.max(0, deadline - Date.now())));
  }
}
