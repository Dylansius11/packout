import {
  chainHeads,
  createOp,
  envelopeDigest,
  type Op,
  type OpBody,
  type RegistryReader,
  type RegistryWriter,
  sealOp,
  ZERO_HEAD,
} from '@packout/sdk';
import { type Address, bytesToHex, type Hex } from 'viem';
import { db } from '../db/db.ts';
import type { StoredOp, WorkspaceRecord } from '../db/types.ts';
import type { TxProgress } from '../hooks/use-tx.ts';
import { StaleHistoryError, staleness } from './staleness.ts';

/**
 * Encrypts one change, appends it from the owner wallet as the next operation, and only then keeps
 * it on this device with the index and transaction Portaldot gave it. If the chain moved on, it
 * stops before asking the wallet for anything.
 */
export async function appendOwnerOp(input: {
  workspace: WorkspaceRecord;
  displayName: string;
  key: Uint8Array;
  body: OpBody;
  account: Address;
  reader: RegistryReader;
  /** Called only once the owner check and the freshness check pass. */
  writer: () => Promise<RegistryWriter>;
  progress: TxProgress;
}): Promise<{ stored: StoredOp; hash: Hex; blockNumber: number }> {
  const { workspace, key, body, account, reader, progress } = input;
  progress.preparing();
  const op: Op = createOp({
    wsId: workspace.wsId,
    author: { memberId: workspace.memberId, name: input.displayName },
    ...body,
  });
  const envelope = sealOp(op, key);
  const digest = envelopeDigest(envelope);

  const onChain = await reader.getWorkspace(workspace.wsId);
  if (!onChain) throw new Error('This workspace no longer exists in the connected registry.');
  if (onChain.owner.toLowerCase() !== account.toLowerCase()) {
    throw new Error(`Only the owner ${onChain.owner} can write from Client B.`);
  }

  const local = await db.ops.where('wsId').equals(workspace.wsId).sortBy('index');
  const heads = chainHeads(
    workspace.wsId,
    0n,
    ZERO_HEAD,
    local.map((stored) => stored.digest),
  );
  const localHead = heads.at(-1) ?? ZERO_HEAD;
  const stale = staleness({ count: local.length, head: localHead }, onChain);
  if (stale) throw new StaleHistoryError(stale);

  progress.wallet();
  const writer = await input.writer();
  const result = await writer.appendBatch(workspace.wsId, onChain.count, onChain.head, [digest], {
    onSubmitted: progress.submitted,
  });
  const event = result.appended.find((appended) => appended.digest === digest);
  if (!event || event.index !== onChain.count) {
    throw new Error(
      'Portaldot accepted the transaction but did not report this operation at the expected position.',
    );
  }

  const blockNumber = Number(result.blockNumber);
  const stored: StoredOp = {
    wsId: workspace.wsId,
    index: Number(event.index),
    digest,
    envelope: bytesToHex(envelope),
    op,
    origin: 'client-b',
    txHash: result.hash,
    blockNumber,
    storedAt: Date.now(),
  };
  await db.transaction('rw', db.workspaces, db.ops, async () => {
    await db.ops.put(stored);
    await db.workspaces.update(workspace.wsId, {
      checkpointBlock: Math.max(workspace.checkpointBlock, blockNumber),
      displayName: input.displayName,
    });
  });
  return { stored, hash: result.hash, blockNumber };
}
