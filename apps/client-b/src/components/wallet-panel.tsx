import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { chain } from '../config/env';
import { Notice } from './notice';
import { Button } from './ui/button';

/** Connect or disconnect the owner wallet. Client B only ever asks for the owner's signature. */
export function WalletPanel() {
  const account = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const walletAvailable =
    connectors.some((connector) => connector.id !== 'injected') || 'ethereum' in window;

  if (account.isConnected) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>
          Wallet connected: <code className="break-all">{account.address}</code>
        </span>
        <Button variant="ghost" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </p>
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
      <div className="flex flex-wrap gap-2">
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
      {isPending ? <p className="text-sm text-muted-foreground">Waiting for your wallet…</p> : null}
      {error ? <p className="text-sm text-danger">{error.message.split('\n')[0]}</p> : null}
    </div>
  );
}
