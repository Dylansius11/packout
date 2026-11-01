import type { WorkspaceOnChain } from '@packout/sdk';
import { ArrowRight } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { connectedWriter } from '@/chain/wallet';
import { ChainFacts } from '@/components/chain-facts';
import { Notice } from '@/components/notice';
import { PageHead } from '@/components/page-head';
import { TxRef } from '@/components/tx-ref';
import { TxStatus } from '@/components/tx-status';
import { Button } from '@/components/ui/button';
import { WalletPanel } from '@/components/wallet-panel';
import { publicClient, registryReader } from '../../chain/clients';
import type { WorkspaceRecord } from '../../db/types';
import type { Access } from '../../domain/gating';
import { takeOverWorkspace } from '../../domain/takeover';
import { txPending, useTx } from '../../hooks/use-tx';
import { useRestoreFocusWhenIdle } from '../../lib/focus';

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
  const tx = useTx(publicClient);
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
  const takeOverButton = useRef<HTMLButtonElement>(null);
  // Connecting removes the Connect button and sending disables this one: keep keyboard focus on the action.
  useRestoreFocusWhenIdle(pending, takeOverButton);
  useRestoreFocusWhenIdle(!account.isConnected, takeOverButton);

  if (taken) {
    return (
      <div className="space-y-14">
        <PageHead title="Taken over" />
        <Notice tone="success" title={`The workspace is now at epoch ${newEpoch ?? taken.epoch}`}>
          <p>
            Vendor A and every other earlier writer have lost write access. The history stays, and
            you can keep writing from this app with your owner wallet.
          </p>
          <p className="pt-2">
            <TxRef txHash={taken.txHash} blockNumber={taken.blockNumber} />
          </p>
        </Notice>
        <TxStatus
          state={tx.state}
          doneText="Taken over. Vendor A can no longer write to this workspace."
        />
        <ChainFacts onChain={onChain} registry={workspace.registry} />
        <Button onClick={props.onContinue} disabled={pending}>
          Continue writing
          <ArrowRight size={16} aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      <PageHead title="Take over this workspace">
        <p>Only the owner can do this. It is one transaction from your wallet.</p>
      </PageHead>

      <ChainFacts onChain={onChain} registry={workspace.registry} />

      <section aria-labelledby="owner-wallet" className="space-y-5">
        <h2 id="owner-wallet" className="baseline depth-0 text-[14px]">
          Owner wallet
        </h2>
        <WalletPanel />
        {!action.open ? (
          <Notice tone={account.isConnected ? 'danger' : 'info'} title="Take over is locked">
            {action.reason}
          </Notice>
        ) : null}
      </section>

      <section aria-labelledby="what-happens" className="space-y-6">
        <h2 id="what-happens" className="baseline depth-0 text-[14px]">
          What will happen
        </h2>
        <p className="max-w-[40ch] text-[clamp(1.25rem,2.2vw,1.625rem)] leading-snug text-ivory">
          Vendor A and every other current writer lose write access. History stays.
        </p>
        <p aria-hidden className="baseline depth-1 tabular text-[15px]">
          Epoch {onChain.epoch} → {onChain.epoch + 1}
        </p>
        <p className="prose-ash text-[16px]">
          Sends <code className="hash text-ivory">rotateEpoch</code> with no new writers: the epoch
          goes from {onChain.epoch} to {onChain.epoch + 1}. You, as owner, can always write.
        </p>
        <div className="space-y-6 pt-2">
          <Button ref={takeOverButton} onClick={takeOver} disabled={!action.open || pending}>
            {pending ? 'Taking over…' : 'Take over this workspace'}
          </Button>
          <TxStatus
            state={tx.state}
            doneText="Taken over. Vendor A can no longer write to this workspace."
          />
        </div>
      </section>
    </div>
  );
}
