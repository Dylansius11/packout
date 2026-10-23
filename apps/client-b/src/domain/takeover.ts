import type { RegistryReader, RegistryWriter } from '@packout/sdk';
import type { Address, Hex } from 'viem';
import { db } from '../db/db.ts';
import type { WorkspaceRecord } from '../db/types.ts';
import type { TxProgress } from '../hooks/use-tx.ts';

/**
 * Sends `rotateEpoch(wsId, [])`: the epoch advances and every earlier writer, Vendor A included,
 * loses write access. The owner (this wallet) can always write, so no new writer is authorized.
 * The result is read back from Portaldot and kept on this device.
 */
export async function takeOverWorkspace(input: {
  workspace: WorkspaceRecord;
  account: Address;
  reader: RegistryReader;
  writer: () => Promise<RegistryWriter>;
  progress: TxProgress;
}): Promise<{ hash: Hex; blockNumber: number; epoch: number }> {
  const { workspace, account, reader, progress } = input;
  progress.preparing();
  const before = await reader.getWorkspace(workspace.wsId);
  if (!before) throw new Error('This workspace no longer exists in the connected registry.');
  if (before.owner.toLowerCase() !== account.toLowerCase()) {
    throw new Error(`Only the owner ${before.owner} can take over this workspace.`);
  }

  progress.wallet();
  const writer = await input.writer();
  const result = await writer.rotateEpoch(workspace.wsId, [], { onSubmitted: progress.submitted });

  const after = await reader.getWorkspace(workspace.wsId);
  if (!after || after.epoch <= before.epoch) {
    throw new Error('The transaction was included but Portaldot did not report a new epoch.');
  }
  const blockNumber = Number(result.blockNumber);
  await db.workspaces.update(workspace.wsId, {
    takeover: { epoch: after.epoch, txHash: result.hash, blockNumber },
  });
  return { hash: result.hash, blockNumber, epoch: after.epoch };
}
