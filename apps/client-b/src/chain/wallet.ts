import { createRegistryWriter, type RegistryWriter } from '@packout/sdk';
import { getWalletClient, switchChain } from 'wagmi/actions';
import { chain, registryLookup } from '../config/env.ts';
import { publicClient } from './clients.ts';
import { wagmiConfig } from './wagmi.ts';

/** Moves the wallet to this build's chain if needed, then returns a registry writer signing with it. */
export async function connectedWriter(walletChainId: number | undefined): Promise<RegistryWriter> {
  if (!registryLookup.ok) throw new Error(registryLookup.message);
  if (walletChainId !== chain.id) await switchChain(wagmiConfig, { chainId: chain.id });
  const wallet = await getWalletClient(wagmiConfig, { chainId: chain.id });
  return createRegistryWriter({
    wallet,
    client: publicClient,
    registry: registryLookup.registry.address,
  });
}
