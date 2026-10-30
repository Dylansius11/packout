import { ApiPromise } from '@polkadot/api';
import { NativeHttpProvider } from './native-http.ts';
import { NativeWsProvider } from './native-ws.ts';

export async function connectNative(rpc: string): Promise<ApiPromise> {
  const endpoint = new URL(rpc);
  const websocket = endpoint.protocol === 'ws:' || endpoint.protocol === 'wss:';
  // Read-only transports never subscribe or reconnect. Bound socket connection,
  // API initialization, and each individual RPC request independently.
  const provider = websocket
    ? new NativeWsProvider(endpoint.href)
    : new NativeHttpProvider(endpoint.href);
  let api: ApiPromise | undefined;
  let timeout: NodeJS.Timeout | undefined;
  let timeoutError: Error | undefined;
  try {
    return await new Promise<ApiPromise>((resolve, reject) => {
      timeout = setTimeout(() => {
        timeoutError = new Error(
          'Native RPC connection and initialization timed out after 15 seconds.',
        );
        // Disconnect the real socket / abort HTTP requests before rejecting.
        // A rejected promise alone would leave a stalled connection alive.
        void provider.disconnect().then(() => reject(timeoutError), reject);
      }, 15_000);
      void (async () => {
        if (websocket) await provider.connect();
        api = new ApiPromise({ provider, throwOnConnect: true, noInitWarn: true });
        return api.isReadyOrError;
      })().then(resolve, reject);
    });
  } catch (error) {
    await provider.disconnect();
    if (api) await api.disconnect();
    throw timeoutError ?? error;
  } finally {
    clearTimeout(timeout);
  }
}
