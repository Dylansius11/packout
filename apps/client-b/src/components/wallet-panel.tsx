import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { chain } from '../config/env';
import { Notice } from './notice';
import { Button } from './ui/button';

/** Connect or disconnect the owner wallet. Packout Restore only ever asks for the owner's signature. */
export function WalletPanel() {
  const account = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const walletAvailable =
    connectors.some((connector) => connector.id !== 'injected') || 'ethereum' in window;

  if (account.isConnected) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <p className="min-w-0 text-[16px] text-ash">
          <span className="baseline depth-2 mr-3 text-[11px]">Wallet connected</span>
          <code className="hash break-all text-[13px] text-ivory">{account.address}</code>
        </p>
        <Button variant="ghost" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }
  if (!walletAvailable) {
    return (
      <Notice tone="warning" title="No browser wallet found">
        Install an EVM wallet such as MetaMask and add the {chain.name} network (chain id {chain.id}
        ), then reload this page. Your restored workspace stays on this device.
      </Notice>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {connectors.map((connector) => (
          <Button
            key={connector.uid}
            variant="outline"
            onClick={() => connect({ connector, chainId: chain.id })}
            disabled={isPending}
          >
            {connector.id === 'mock' ? 'Connect local test account' : `Connect ${connector.name}`}
          </Button>
        ))}
      </div>
      {isPending ? <p className="text-[16px] text-ash">Waiting for your wallet…</p> : null}
      {error ? (
        <div role="alert" className="space-y-2">
          <span aria-hidden className="baseline reversed inline-block text-[11px]">
            Failed
          </span>
          <p className="text-[16px] text-ivory">
            <span className="sr-only">Failed: </span>
            {error.message.split('\n')[0]}
          </p>
        </div>
      ) : null}
    </div>
  );
}
