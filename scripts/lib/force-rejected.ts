import { packoutRegistryAbi, type TxResult } from '@packout/sdk';
import { encodeFunctionData, type Hex } from 'viem';
import { z } from 'zod';
import type { DemoSession } from './runtime.ts';

const hashData = z.object({
  txHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .transform((value): Hex => value as Hex),
});
const revertData = z.object({ errorName: z.string(), args: z.array(z.unknown()).optional() });

// Hardhat can mine a reverted transaction yet return an RPC error carrying its
// real txHash. Never infer a hash from message text or fabricate one.
export function submittedHashFromError(error: unknown): Hex | null {
  let cause = error;
  while (cause && typeof cause === 'object') {
    const parsed = hashData.safeParse('data' in cause ? cause.data : undefined);
    if (parsed.success) return parsed.data.txHash;
    cause = 'cause' in cause ? cause.cause : undefined;
  }
  return null;
}

export function decodedRevert(error: unknown): string | null {
  let cause = error;
  while (cause && typeof cause === 'object') {
    if ('name' in cause && cause.name === 'ContractFunctionRevertedError' && 'data' in cause) {
      const parsed = revertData.safeParse(cause.data);
      if (
        parsed.success &&
        packoutRegistryAbi.some(
          (entry) => entry.type === 'error' && entry.name === parsed.data.errorName,
        )
      ) {
        return `${parsed.data.errorName}(${(parsed.data.args ?? []).map(String).join(', ')})`;
      }
    }
    cause = 'cause' in cause ? cause.cause : undefined;
  }
  return null;
}

export interface RejectedAppendRequest {
  wsId: Hex;
  expectedCount: bigint;
  expectedHead: Hex;
  digests: Hex[];
  successfulAppendGasUsed: bigint;
  onSubmitted: (hash: Hex) => void;
}
export type RejectedAppendResult = TxResult & {
  status: 'reverted';
  revertReason: string | null;
  gasLimit: bigint;
};

export async function forceRejectedAppend(
  session: Pick<
    DemoSession,
    'client' | 'vendorAddress' | 'vendorWallet' | 'vendor' | 'chain' | 'deployment'
  >,
  input: RejectedAppendRequest,
): Promise<RejectedAppendResult> {
  const args = [input.wsId, input.expectedCount, input.expectedHead, input.digests] as const;
  const data = encodeFunctionData({ abi: packoutRegistryAbi, functionName: 'appendBatch', args });
  const gas = input.successfulAppendGasUsed * 2n;
  const gasPrice = await session.client.getGasPrice();
  const beforeSubmission = await session.client.getBlockNumber({ cacheTime: 0 });
  const nonce = await session.client.getTransactionCount({
    address: session.vendorAddress,
    blockTag: 'pending',
  });
  let hash: Hex;
  try {
    // Deliberately no simulation: the SDK has already refused this write. This
    // one transaction exists only to leave a mined rejection as demo evidence.
    hash = await session.vendorWallet.sendTransaction({
      account: session.vendor,
      chain: session.chain,
      to: session.deployment.address,
      data,
      gas,
      gasPrice,
      nonce,
      type: 'legacy',
    });
  } catch (error) {
    let minedHash = submittedHashFromError(error);
    if (!minedHash) {
      // Some RPCs (including default Hardhat 3) mine the failure but return only
      // revert bytes. Recover its observed hash by sender + explicit nonce and
      // exact call, never from a guessed hash or the error's message.
      const end = await session.client.getBlockNumber({ cacheTime: 0 });
      const vendorAddress = session.vendorAddress.toLowerCase();
      const registry = session.deployment.address.toLowerCase();
      for (let blockNumber = beforeSubmission; blockNumber <= end; blockNumber++) {
        const block = await session.client.getBlock({ blockNumber, includeTransactions: true });
        const transaction = block.transactions.find(
          (tx) =>
            tx.from.toLowerCase() === vendorAddress &&
            tx.nonce === nonce &&
            tx.to?.toLowerCase() === registry &&
            tx.input === data,
        );
        if (transaction) {
          minedHash = transaction.hash;
          break;
        }
      }
    }
    if (!minedHash) throw error;
    hash = minedHash;
  }
  input.onSubmitted(hash);
  const receipt = await session.client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'reverted')
    throw new Error(
      `Vendor comeback transaction ${hash} was accepted. Do not present this run as successful.`,
    );
  let revertReason: string | null = null;
  try {
    await session.client.simulateContract({
      abi: packoutRegistryAbi,
      address: session.deployment.address,
      functionName: 'appendBatch',
      args,
      account: session.vendorAddress,
      blockNumber: receipt.blockNumber,
      gas,
      gasPrice,
      type: 'legacy',
    });
  } catch (error) {
    revertReason = decodedRevert(error);
  }
  console.log('Vendor rejection: mined receipt status = reverted.');
  console.log(
    revertReason
      ? `RPC revert reason: ${revertReason}`
      : 'RPC did not return a decodable revert reason.',
  );
  return {
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    status: 'reverted',
    revertReason,
    gasLimit: gas,
  };
}
