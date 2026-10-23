import { createRegistryReader, type RegistryReader } from '@packout/sdk';
import { createPublicClient, http, type PublicClient } from 'viem';
import { chain, registryLookup } from '../config/env.ts';

export const publicClient: PublicClient = createPublicClient({ chain, transport: http() });

/** Registry reads for the deployment this build was made for; null when no deployment record exists. */
export const registryReader: RegistryReader | null = registryLookup.ok
  ? createRegistryReader({
      client: publicClient,
      registry: registryLookup.registry.address,
      fromBlock: registryLookup.registry.fromBlock,
    })
  : null;
