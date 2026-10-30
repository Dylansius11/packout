import { HttpProvider } from '@polkadot/api';
import { parseNativeRpcResponse } from './native-rpc.ts';

// HttpProvider supplies the API's non-subscription connection semantics, but its
// fetch has no timeout/cancellation hook. Override requests, including clones.
export class NativeHttpProvider extends HttpProvider {
  #endpoint: string;
  #nextId = 0;
  #pending = new Set<AbortController>();
  #disconnected = false;

  constructor(endpoint: string) {
    super(endpoint, {}, 0);
    this.#endpoint = endpoint;
  }

  override clone(): NativeHttpProvider {
    return new NativeHttpProvider(this.#endpoint);
  }

  override get isConnected(): boolean {
    return !this.#disconnected;
  }

  override async disconnect(): Promise<void> {
    this.#disconnected = true;
    for (const controller of this.#pending)
      controller.abort(new Error('Native RPC disconnected; pending request cancelled.'));
    this.#pending.clear();
  }

  override async send<T>(method: string, params: unknown[]): Promise<T> {
    if (this.#disconnected) throw new Error('Native RPC is disconnected.');
    const controller = new AbortController();
    this.#pending.add(controller);
    // The same fixed 15-second request deadline as the EVM reader. Abort fetch
    // itself, including a stalled response body, rather than racing its promise.
    const timeout = setTimeout(() => {
      controller.abort(new Error('Native RPC request timed out after 15 seconds.'));
    }, 15_000);
    try {
      const id = ++this.#nextId;
      const response = await fetch(this.#endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Native RPC returned HTTP ${response.status}.`);
      const parsed = parseNativeRpcResponse(await response.json());
      if (parsed.id !== id) throw new Error('Native RPC returned a mismatched JSON-RPC response.');
      if (parsed.error) {
        const { code, message, data } = parsed.error;
        throw Object.assign(new Error(message), { code, data });
      }
      // The API's runtime codecs validate each RPC method's result shape.
      return parsed.result as T;
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timeout);
      this.#pending.delete(controller);
      // Also release unread bodies on HTTP/JSON/validation failures.
      controller.abort();
    }
  }
}
