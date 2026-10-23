import {
  type Address,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hex,
  type PublicClient,
  parseEventLogs,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import type { AppendedEvent } from '../chain-reader.ts';
import { packoutRegistryAbi } from './abi.ts';
import { registryFailure } from './errors.ts';

export type TxResult = {
  hash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
};
export type SubmissionOptions = { onSubmitted?: (hash: Hex) => void };
export interface RegistryWriter {
  createWorkspace(
    salt: Hex,
    schemaId: Hex,
    options?: SubmissionOptions,
  ): Promise<TxResult & { wsId: Hex }>;
  grantWriter(wsId: Hex, writer: Address, options?: SubmissionOptions): Promise<TxResult>;
  revokeWriter(wsId: Hex, writer: Address, options?: SubmissionOptions): Promise<TxResult>;
  rotateEpoch(wsId: Hex, newWriters: Address[], options?: SubmissionOptions): Promise<TxResult>;
  appendBatch(
    wsId: Hex,
    expectedCount: bigint,
    expectedHead: Hex,
    digests: Hex[],
    options?: SubmissionOptions,
  ): Promise<TxResult & { appended: AppendedEvent[] }>;
}
export interface RegistryWriterOptions {
  wallet: WalletClient;
  client: PublicClient;
  registry: Address;
}

type WriteName = ContractFunctionName<typeof packoutRegistryAbi, 'nonpayable'>;
type WriteCall = {
  [Name in WriteName]: {
    functionName: Name;
    args: ContractFunctionArgs<typeof packoutRegistryAbi, 'nonpayable', Name>;
  };
}[WriteName];

function txResult(receipt: TransactionReceipt): TxResult {
  return {
    hash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  };
}

export function createRegistryWriter({
  wallet,
  client,
  registry,
}: RegistryWriterOptions): RegistryWriter {
  async function submit(call: WriteCall, options?: SubmissionOptions): Promise<TransactionReceipt> {
    let hash: Hex;
    try {
      const account = wallet.account ?? (await wallet.getAddresses())[0];
      if (!account) throw new Error('Connect a wallet account before writing to the registry.');
      const gasPrice = await client.getGasPrice();
      const parameters = {
        ...call,
        abi: packoutRegistryAbi,
        address: registry,
        account,
        type: 'legacy' as const,
        gasPrice,
      };
      await client.simulateContract<
        typeof packoutRegistryAbi,
        WriteName,
        WriteCall['args'],
        Chain | undefined,
        typeof account
      >(parameters);
      // Portaldot's estimate includes weight/storage costs; never scale or replace it.
      const gas = await client.estimateContractGas<
        Chain | undefined,
        typeof packoutRegistryAbi,
        WriteName,
        WriteCall['args']
      >(parameters);
      hash = await wallet.writeContract<
        typeof packoutRegistryAbi,
        WriteName,
        WriteCall['args'],
        Chain | undefined
      >({
        ...parameters,
        chain: wallet.chain ?? client.chain,
        gas,
      });
    } catch (error) {
      throw registryFailure(error);
    }
    options?.onSubmitted?.(hash);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Registry transaction reverted: ${hash}`);
    return receipt;
  }

  return {
    async createWorkspace(salt, schemaId, options) {
      const receipt = await submit(
        { functionName: 'createWorkspace', args: [salt, schemaId] },
        options,
      );
      const [created] = parseEventLogs({
        abi: packoutRegistryAbi,
        logs: receipt.logs,
        eventName: 'WorkspaceCreated',
        strict: true,
      });
      if (!created)
        throw new Error(
          `WorkspaceCreated event missing from transaction ${receipt.transactionHash}`,
        );
      return { ...txResult(receipt), wsId: created.args.wsId };
    },
    async grantWriter(wsId, writer, options) {
      return txResult(await submit({ functionName: 'grantWriter', args: [wsId, writer] }, options));
    },
    async revokeWriter(wsId, writer, options) {
      return txResult(
        await submit({ functionName: 'revokeWriter', args: [wsId, writer] }, options),
      );
    },
    async rotateEpoch(wsId, newWriters, options) {
      return txResult(
        await submit({ functionName: 'rotateEpoch', args: [wsId, newWriters] }, options),
      );
    },
    async appendBatch(wsId, expectedCount, expectedHead, digests, options) {
      const receipt = await submit(
        { functionName: 'appendBatch', args: [wsId, expectedCount, expectedHead, digests] },
        options,
      );
      const logs = parseEventLogs({
        abi: packoutRegistryAbi,
        logs: receipt.logs,
        eventName: 'Appended',
        strict: true,
      });
      const appended = logs
        .filter((log) => log.address.toLowerCase() === registry.toLowerCase())
        .map((log) => ({
          ...log.args,
          blockNumber: receipt.blockNumber,
          txHash: receipt.transactionHash,
        }));
      return { ...txResult(receipt), appended };
    },
  };
}
