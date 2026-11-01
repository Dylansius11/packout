import { type Address, type Chain, defineChain } from 'viem';
import { z } from 'zod';

const NETWORKS = ['localhost', 'portaldotTestnet'] as const;
export type NetworkName = (typeof NETWORKS)[number];

const envSchema = z.object({
  network: z.enum(NETWORKS),
  vendorApiUrl: z.url(),
  localRpcUrl: z.url({ protocol: /^https?$/ }),
});

// An unset or empty Vite variable means "use the default"; anything else must validate.
const parsed = envSchema.safeParse({
  network: import.meta.env.VITE_PACKOUT_NETWORK || 'localhost',
  vendorApiUrl: import.meta.env.VITE_VENDOR_API_URL || 'http://localhost:8787',
  localRpcUrl: import.meta.env.VITE_LOCAL_RPC_URL || 'http://127.0.0.1:8545',
});
if (!parsed.success) {
  throw new Error(
    `Invalid Vendor A environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}. VITE_PACKOUT_NETWORK must be localhost or portaldotTestnet.`,
  );
}

export const network: NetworkName = parsed.data.network;
export const vendorApiUrl = parsed.data.vendorApiUrl.replace(/\/$/, '');
/** Where "Exit-ready with Packout" points: the Packout landing page. */
export const packoutSiteUrl = import.meta.env.VITE_PACKOUT_SITE_URL || 'http://localhost:5175';

const chains = {
  localhost: defineChain({
    id: 31337,
    name: 'Local test chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [parsed.data.localRpcUrl] } },
  }),
  portaldotTestnet: defineChain({
    id: 420420777,
    name: 'Portaldot testnet',
    nativeCurrency: { name: 'tPOTv3', symbol: 'tPOTv3', decimals: 18 },
    rpcUrls: { default: { http: ['https://test-evm-rpc-v3.portaldot.dev'] } },
    blockExplorers: {
      default: { name: 'Portaldot scanner', url: 'https://scanner-testnet-v3.portaldot.dev' },
    },
  }),
} as const;

export const chain: Chain = chains[network];
export const rpcHost = new URL(chains[network].rpcUrls.default.http[0]).host;

const deploymentSchema = z.object({
  chainId: z.int(),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  blockNumber: z.union([z.string(), z.number()]).transform((value) => BigInt(value)),
});

// contracts/deployments/<network>.json is written by the deploy scripts; Vite bundles it at build time.
const deployments = import.meta.glob('../../../../contracts/deployments/*.json', {
  eager: true,
  import: 'default',
});

type Registry = { address: Address; fromBlock: bigint };
export type RegistryLookup = { ok: true; registry: Registry } | { ok: false; message: string };

function lookupRegistry(): RegistryLookup {
  // Isolated local stacks may inject a deployment without replacing developers' localhost.json.
  const injected: unknown = import.meta.env.VITE_PACKOUT_DEPLOYMENT;
  const entry = injected
    ? ['VITE_PACKOUT_DEPLOYMENT', injected]
    : Object.entries(deployments).find(([path]) => path.endsWith(`/${network}.json`));
  if (!entry) {
    return {
      ok: false,
      message: `No registry deployment for ${network}: contracts/deployments/${network}.json was not found when this app was built. Deploy the contract, then restart the dev server.`,
    };
  }
  const result = deploymentSchema.safeParse(entry[1]);
  if (!result.success) {
    return {
      ok: false,
      message: `contracts/deployments/${network}.json is not a valid deployment record.`,
    };
  }
  if (result.data.chainId !== chain.id) {
    return {
      ok: false,
      message: `contracts/deployments/${network}.json is for chain ${result.data.chainId}, but ${network} is chain ${chain.id}.`,
    };
  }
  return {
    ok: true,
    registry: { address: result.data.address as Address, fromBlock: result.data.blockNumber },
  };
}

export const registryLookup = lookupRegistry();

/** Block page on the Portaldot scanner; EVM transactions have no page of their own (INTEGRATIONS.md 1.2). */
export function blockUrl(blockNumber: number): string | null {
  const explorer = chain.blockExplorers?.default.url;
  return explorer ? `${explorer}/#/blocks/${blockNumber}` : null;
}
