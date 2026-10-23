import type { WorkspaceOnChain } from '@packout/sdk';
import { ArrowRight, ShieldCheck } from '@phosphor-icons/react';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { connectedWriter } from '@/chain/wallet';
import { ChainFacts } from '@/components/chain-facts';
import { Notice } from '@/components/notice';
import { TxRef } from '@/components/tx-ref';
import { TxStatus } from '@/components/tx-status';
import { Button } from '@/components/ui/button';
import { WalletPanel } from '@/components/wallet-panel';
import { registryReader } from '../../chain/clients';
import type { WorkspaceRecord } from '../../db/types';
import type { Access } from '../../domain/gating';
import { takeOverWorkspace } from '../../domain/takeover';
import { txPending, useTx } from '../../hooks/use-tx';

/** Step 3: one `rotateEpoch` transaction that ends the old vendor's write access. */
export function TakeoverScreen(props: {
  workspace: WorkspaceRecord;
  onChain: WorkspaceOnChain;
  action: Access;
  onTakenOver: () => void;
  onContinue: () => void;
}) {
  const { workspace, onChain, action } = props;
  const account = useAccount();
  const tx = useTx();
  const [newEpoch, setNewEpoch] = useState<number | null>(null);
  const taken = workspace.takeover;

  async function takeOver() {
    const address = account.address;
    const reader = registryReader;
    if (!address || !reader || !action.open) return;
    const result = await tx.run((progress) =>
      takeOverWorkspace({
        workspace,
        account: address,
        reader,
        writer: () => connectedWriter(account.chainId),
        progress,
      }),
    );
    if (result) {
      setNewEpoch(result.epoch);
      props.onTakenOver();
    }
  }

  const pending = txPending(tx.state);

  if (taken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Taken over</h1>
        <Notice tone="success" title={`The workspace is now at epoch ${newEpoch ?? taken.epoch}`}>
          <p>
            Vendor A and every other earlier writer have lost write access. The history stays, and
            you can keep writing from this app with your owner wallet.
          </p>
          <p className="mt-1">
            <TxRef txHash={taken.txHash} blockNumber={taken.blockNumber} />
          </p>
        </Notice>
        <ChainFacts onChain={onChain} registry={workspace.registry} />
        <Button onClick={props.onContinue}>
          Continue writing
          <ArrowRight size={16} aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Take over this workspace</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Only the owner can do this. It is one transaction from your wallet.
        </p>
      </div>

      <ChainFacts onChain={onChain} registry={workspace.registry} />

      <section aria-labelledby="owner-wallet" className="space-y-3">
        <h2 id="owner-wallet" className="text-base font-semibold">
          Owner wallet
        </h2>
        <WalletPanel />
        {!action.open ? (
          <Notice tone={account.isConnected ? 'danger' : 'info'} title="Take over is locked">
            {action.reason}
          </Notice>
        ) : null}
      </section>

      <section
        aria-labelledby="what-happens"
        className="space-y-3 rounded-md border border-border bg-surface p-4"
      >
        <h2 id="what-happens" className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck size={20} className="text-primary" aria-hidden />
          What will happen
        </h2>
        <p className="text-sm">
          Vendor A and every other current writer lose write access. History stays.
        </p>
        <p className="text-xs text-muted-foreground">
          Sends <code>rotateEpoch</code> with no new writers: the epoch goes from {onChain.epoch} to{' '}
          {onChain.epoch + 1}. You, as owner, can always write.
        </p>
        <Button onClick={takeOver} disabled={!action.open || pending}>
          {pending ? 'Taking over…' : 'Take over this workspace'}
        </Button>
        <TxStatus
          state={tx.state}
          doneText="Taken over. Vendor A can no longer write to this workspace."
        />
      </section>
    </div>
  );
}
