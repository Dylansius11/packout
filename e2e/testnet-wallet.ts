import type { BrowserContext } from '@playwright/test';
import { createPublicClient, createWalletClient, defineChain, type Hex, http, toHex } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { z } from 'zod';

export const TESTNET_RPC = 'https://test-evm-rpc-v3.portaldot.dev';
export const testnet = defineChain({
  id: 420420777,
  name: 'Portaldot Testnet',
  nativeCurrency: { name: 'Test Portaldot', symbol: 'tPOT', decimals: 18 },
  rpcUrls: { default: { http: [TESTNET_RPC] } },
});
export const client = createPublicClient({ chain: testnet, transport: http(TESTNET_RPC) });
export const hex = z
  .string()
  .regex(/^0x(?:[0-9a-fA-F]{2})*$/)
  .transform((value) => value as Hex);
const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value as `0x${string}`);
const quantity = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .transform(BigInt);
const requestSchema = z.object({ method: z.string(), params: z.array(z.unknown()).default([]) });
const transactionSchema = z.object({
  from: address,
  to: address,
  data: hex.optional(),
  value: quantity.optional(),
  gas: quantity.optional(),
  gasPrice: quantity.optional(),
  maxFeePerGas: quantity.optional(),
  maxPriorityFeePerGas: quantity.optional(),
  nonce: quantity.optional(),
  chainId: quantity.optional(),
});

export function shortError(error: unknown): string {
  if (error && typeof error === 'object' && 'shortMessage' in error)
    return String(error.shortMessage);
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

/** Only RPC requests cross the binding; the account and signing key never leave Node. */
export async function installOwnerWallet(
  context: BrowserContext,
  account: PrivateKeyAccount,
  onSubmitted: (hash: Hex) => void,
  onFailure: (method: string, message: string) => void,
) {
  const wallet = createWalletClient({ account, chain: testnet, transport: http(TESTNET_RPC) });
  let authorized = false;
  await context.exposeBinding('packoutWalletRequest', async ({ frame }, input: unknown) => {
    const origin = new URL(frame.url()).origin;
    if (
      !['https://packout-vendor-a.vercel.app', 'https://packout-restore.vercel.app'].includes(
        origin,
      )
    )
      throw new Error('The signing wallet is restricted to the two hosted PACKOUT apps.');
    const { method, params } = requestSchema.parse(input);
    try {
      switch (method) {
        case 'eth_accounts':
          return authorized ? [account.address] : [];
        case 'eth_requestAccounts':
          authorized = true;
          return [account.address];
        case 'eth_chainId':
          return toHex(testnet.id);
        case 'net_version':
          return String(testnet.id);
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain': {
          const target = z.object({ chainId: quantity }).parse(params[0]);
          if (target.chainId !== BigInt(testnet.id)) throw new Error('Unsupported wallet chain.');
          return null;
        }
        case 'eth_sendTransaction': {
          const tx = transactionSchema.parse(params[0]);
          if (tx.from.toLowerCase() !== account.address.toLowerCase())
            throw new Error('The transaction does not belong to the ephemeral owner.');
          if (tx.chainId !== undefined && tx.chainId !== BigInt(testnet.id))
            throw new Error('The transaction targets a different chain.');
          const hash = await wallet.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value,
            gas: tx.gas,
            nonce: tx.nonce === undefined ? undefined : Number(tx.nonce),
            ...(tx.maxFeePerGas === undefined
              ? { gasPrice: tx.gasPrice, type: 'legacy' as const }
              : {
                  maxFeePerGas: tx.maxFeePerGas,
                  maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
                  type: 'eip1559' as const,
                }),
          });
          onSubmitted(hash);
          return hash;
        }
        case 'personal_sign': {
          const [message, signer] = z.tuple([hex, address]).parse(params);
          if (signer.toLowerCase() !== account.address.toLowerCase())
            throw new Error('The message does not belong to the ephemeral owner.');
          return wallet.signMessage({ message: { raw: message } });
        }
        case 'eth_signTypedData_v4': {
          const [signer, serialized] = z.tuple([address, z.string()]).parse(params);
          if (signer.toLowerCase() !== account.address.toLowerCase())
            throw new Error('The typed message does not belong to the ephemeral owner.');
          const typed = z
            .object({
              domain: z.record(z.string(), z.unknown()),
              types: z.record(
                z.string(),
                z.array(z.object({ name: z.string(), type: z.string() })),
              ),
              primaryType: z.string(),
              message: z.record(z.string(), z.unknown()),
            })
            .parse(JSON.parse(serialized));
          return wallet.signTypedData(typed);
        }
        default: {
          // Forward unhandled read methods verbatim; never relay node-managed signing methods.
          if (/^(eth_send|eth_sign|wallet_|personal_)/.test(method))
            throw new Error(`Unsupported signing method: ${method}`);
          const response = await fetch(TESTNET_RPC, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            signal: AbortSignal.timeout(60_000),
          });
          if (!response.ok) throw new Error(`RPC ${method}: HTTP ${response.status}`);
          const result = z
            .object({
              result: z.unknown().optional(),
              error: z.object({ code: z.number(), message: z.string() }).optional(),
            })
            .parse(await response.json());
          if (result.error) throw new Error(`RPC ${method}: ${result.error.message}`);
          return result.result;
        }
      }
    } catch (error) {
      const message = shortError(error);
      onFailure(method, message);
      throw new Error(message);
    }
  });
  await context.addInitScript(() => {
    type Listener = (...args: unknown[]) => void;
    const listeners = new Map<string, Set<Listener>>();
    const bridge = window as unknown as {
      ethereum: unknown;
      packoutWalletRequest: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    const provider = {
      request: (request: { method: string; params?: unknown[] }) =>
        bridge.packoutWalletRequest(request),
      on(event: string, listener: Listener) {
        const group = listeners.get(event) ?? new Set<Listener>();
        group.add(listener);
        listeners.set(event, group);
        return provider;
      },
      removeListener(event: string, listener: Listener) {
        listeners.get(event)?.delete(listener);
        return provider;
      },
      isConnected: () => true,
    };
    bridge.ethereum = provider;
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: Object.freeze({
            info: {
              uuid: '01a24b42-b386-4bed-9b1d-7f17a864c201',
              name: 'PACKOUT Testnet Owner',
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="black"/></svg>',
              rdns: 'dev.packout.testnet-owner',
            },
            provider,
          }),
        }),
      );
    window.addEventListener('eip6963:requestProvider', announce);
    announce();
  });
}
