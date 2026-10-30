import { HttpProvider } from '@polkadot/api';
import WebSocket from 'ws';
import { parseNativeRpcResponse } from './native-rpc.ts';

interface PendingRequest {
  resolve(value: unknown): void;
  reject(reason: unknown): void;
  timeout: NodeJS.Timeout;
}

// Read-only RPC uses HttpProvider's non-subscription API semantics. Own the Node
// socket so disconnect can terminate CONNECTING/OPEN peers without a close ACK.
export class NativeWsProvider extends HttpProvider {
  #endpoint: string;
  #socket: WebSocket | undefined;
  #closed: Promise<void> = Promise.resolve();
  #reason: Error | undefined;
  #nextId = 0;
  #pending = new Map<number, PendingRequest>();

  constructor(endpoint: string) {
    super(endpoint.replace(/^ws(s?):/, 'http$1:'), {}, 0);
    this.#endpoint = endpoint;
  }

  override clone(): NativeWsProvider {
    return new NativeWsProvider(this.#endpoint);
  }

  override get isConnected(): boolean {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  override async connect(): Promise<void> {
    if (this.#socket) throw new Error('Native WebSocket connection was already opened.');
    if (this.#reason) throw this.#reason;
    const socket = new WebSocket(this.#endpoint, { handshakeTimeout: 15_000 });
    this.#socket = socket;
    this.#closed = new Promise<void>((resolve) => {
      socket.once('close', () => {
        this.#reason ??= new Error('Native WebSocket disconnected.');
        for (const pending of this.#pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(this.#reason);
        }
        this.#pending.clear();
        resolve();
      });
    });
    socket.on('error', (error) => {
      this.#reason ??= error;
      void this.disconnect();
    });
    socket.on('message', (data) => {
      try {
        const response = parseNativeRpcResponse(JSON.parse(data.toString()));
        const pending = this.#pending.get(response.id);
        if (!pending)
          throw new Error('Native WebSocket returned a mismatched response identifier.');
        this.#pending.delete(response.id);
        clearTimeout(pending.timeout);
        if (response.error) {
          const { code, message, data } = response.error;
          pending.reject(Object.assign(new Error(message), { code, data }));
        } else {
          pending.resolve(response.result);
        }
      } catch (error) {
        this.#reason ??=
          error instanceof Error ? error : new Error('Malformed native WebSocket response.');
        void this.disconnect();
      }
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#reason ??= new Error('Native WebSocket handshake timed out after 15 seconds.');
        void this.disconnect();
      }, 15_000);
      const onClose = () => {
        clearTimeout(timeout);
        reject(this.#reason);
      };
      socket.once('close', onClose);
      socket.once('open', () => {
        clearTimeout(timeout);
        socket.off('close', onClose);
        resolve();
      });
    });
  }

  override async disconnect(): Promise<void> {
    this.#reason ??= new Error('Native WebSocket disconnected; pending request cancelled.');
    if (this.#socket && this.#socket.readyState !== WebSocket.CLOSED) this.#socket.terminate();
    // Do not report cancellation while the underlying socket is still alive.
    await this.#closed;
  }

  override async send<T>(method: string, params: unknown[]): Promise<T> {
    const socket = this.#socket;
    if (!socket || socket.readyState !== WebSocket.OPEN)
      throw new Error('Native WebSocket is not connected.');
    const id = ++this.#nextId;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#reason ??= new Error('Native WebSocket RPC request timed out after 15 seconds.');
        void this.disconnect();
      }, 15_000);
      this.#pending.set(id, {
        // Method-specific results are validated by the API's runtime codecs.
        resolve: (result) => resolve(result as T),
        reject,
        timeout,
      });
      try {
        socket.send(body, (error) => {
          if (error) {
            this.#reason ??= error;
            void this.disconnect();
          }
        });
      } catch (error) {
        this.#reason ??=
          error instanceof Error ? error : new Error('Native WebSocket send failed.');
        void this.disconnect();
      }
    });
  }
}
