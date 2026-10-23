import {
  describeRegistryError,
  RegistryError,
  type RegistryReader,
  type RegistryWriter,
} from '@packout/sdk';
import type { Hex } from 'viem';
import type { ReceiptLookup, SubmittedReceipt } from './receipts.ts';
import type { EnvelopeStore } from './store.ts';

export interface Batcher {
  start(): void;
  tick(): Promise<void>;
  stop(): Promise<void>;
}
export interface BatcherOptions {
  store: EnvelopeStore;
  reader: Pick<RegistryReader, 'getWorkspace'>;
  writer: Pick<RegistryWriter, 'appendBatch'>;
  receipts: ReceiptLookup;
  wsId: Hex;
  intervalMs: number;
}

export function createBatcher({
  store,
  reader,
  writer,
  receipts,
  wsId,
  intervalMs,
}: BatcherOptions): Batcher {
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;
  const notFoundTicks = new Map<Hex, number>();

  function halt(): void {
    stopped = true;
    clearInterval(timer);
    timer = undefined;
  }

  async function reconcileSubmitted(): Promise<boolean> {
    let unresolved = false;
    for (const { hash, digests } of store.submittedBatches(wsId)) {
      let receipt: SubmittedReceipt | null;
      try {
        receipt = await receipts.lookup(hash);
      } catch (error) {
        notFoundTicks.delete(hash);
        throw error;
      }
      if (receipt === null) {
        const ticks = (notFoundTicks.get(hash) ?? 0) + 1;
        if (ticks < 20) {
          notFoundTicks.set(hash, ticks);
          unresolved = true;
          continue;
        }
        store.setLastError(wsId, 'A submitted batch was never included; resending.');
        store.clearSubmitted(wsId, hash);
      } else if (receipt.status === 'reverted') {
        store.clearSubmitted(wsId, hash);
      } else {
        store.markAnchored(wsId, digests, receipt.appended);
      }
      notFoundTicks.delete(hash);
    }
    return !unresolved;
  }

  async function runTick(): Promise<void> {
    if (stopped || store.getWorkspace(wsId)?.writerState === 'revoked') {
      halt();
      return;
    }
    try {
      if (!(await reconcileSubmitted())) return;
    } catch (error) {
      store.setLastError(wsId, describeRegistryError(error));
      return;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      if (stopped || store.getWorkspace(wsId)?.writerState === 'revoked') {
        halt();
        return;
      }
      // Refresh the queue after a conflict: another batcher may have anchored it.
      const pending = store.pendingEnvelopes(wsId);
      if (pending.length === 0) return;
      if (pending.some((item) => item.txHash !== null)) return;
      const digests = pending.map((item) => item.digest);
      try {
        const workspace = await reader.getWorkspace(wsId);
        if (!workspace)
          throw new Error('The registered workspace does not exist on the selected chain.');
        store.setChainCount(wsId, workspace.count);
        const result = await writer.appendBatch(wsId, workspace.count, workspace.head, digests, {
          onSubmitted(hash) {
            store.markSubmitted(wsId, digests, hash);
          },
        });
        store.markAnchored(wsId, digests, result.appended);
        return;
      } catch (error) {
        const message = describeRegistryError(error);
        if (error instanceof RegistryError && error.reason === 'NotWriter') {
          store.markRevoked(wsId, message);
          halt();
          return;
        }
        store.setLastError(wsId, message);
        if (
          !(error instanceof RegistryError) ||
          (error.reason !== 'StaleCount' && error.reason !== 'StaleHead')
        )
          return;
      }
    }
  }

  function tick(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (!running)
      running = runTick().finally(() => {
        running = undefined;
      });
    return running;
  }

  return {
    tick,
    start() {
      if (!stopped && timer === undefined)
        timer = setInterval(() => {
          void tick();
        }, intervalMs);
    },
    async stop() {
      halt();
      await running;
    },
  };
}
