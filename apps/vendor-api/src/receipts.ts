import { type AppendedEvent, packoutRegistryAbi } from '@packout/sdk';
import { type Address, type Hex, type PublicClient, parseEventLogs } from 'viem';

export type SubmittedReceipt =
  | { status: 'success'; appended: AppendedEvent[] }
  | { status: 'reverted' };
export interface ReceiptLookup {
  lookup(hash: Hex): Promise<SubmittedReceipt | null>;
}

export function createReceiptLookup({
  client,
  registry,
}: {
  client: PublicClient;
  registry: Address;
}): ReceiptLookup {
  return {
    async lookup(hash) {
      try {
        const receipt = await client.getTransactionReceipt({ hash });
        if (receipt.status === 'reverted') return { status: 'reverted' };
        const appended = parseEventLogs({
          abi: packoutRegistryAbi,
          logs: receipt.logs.filter((log) => log.address.toLowerCase() === registry.toLowerCase()),
          eventName: 'Appended',
          strict: true,
        }).map((log) => ({
          ...log.args,
          blockNumber: receipt.blockNumber,
          txHash: receipt.transactionHash,
        }));
        return { status: 'success', appended };
      } catch (error) {
        // Clients can originate from another viem peer copy; do not rely on class identity.
        if (error instanceof Error && error.name === 'TransactionReceiptNotFoundError') return null;
        throw error;
      }
    },
  };
}
