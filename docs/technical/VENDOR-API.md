# Vendor A API contract

`apps/vendor-api` is Vendor A's hosted backend. It stores ciphertext envelopes it cannot read and anchors them on Portaldot with the vendor's writer key. Client B never calls it (ARCHITECTURE.md section 3).

All bodies are JSON. Hex is lowercase `0x…`. Errors use one shape: `{ "error": { "code": string, "message": string } }` where `message` is a plain sentence for the UI.

## Endpoints

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /health` | none | `200 { ok: true, chainId, registry, writer }` |
| `POST /workspaces` | `{ wsId }` | `201 { workspace }`: the API checks on-chain that the workspace exists and that its writer may write. Unknown workspace: `404 unknown-workspace`. Writer not granted: `409 writer-not-granted`. Already registered: `200 { workspace }` |
| `GET /workspaces/:wsId` | none | `200 { workspace }` or `404 unknown-workspace` |
| `POST /workspaces/:wsId/envelopes` | `{ envelope }` (hex, version `0x01`, 41 bytes to 16 KiB) | `202 { item }` with status `pending`. The same envelope digest again: `200 { item }` (idempotent). Writer revoked: `409 writer-revoked` (nothing stored) |
| `GET /workspaces/:wsId/envelopes?after=<seq>&limit=<n>` | `after` defaults to 0, `limit` 1 to 500 (default 200) | `200 { items, nextAfter }` ordered by `seq` |

```ts
type WorkspaceView = {
  wsId: Hex;
  writer: Address;                       // the vendor's writer address
  writerState: 'active' | 'revoked';     // revoked once the chain answered NotWriter
  pending: number;                       // envelopes waiting to be anchored
  anchoredCount: number;                 // envelopes this API saw anchored
  chainCount: number;                    // last on-chain count the API read
  lastError: string | null;              // plain sentence, e.g. "Write access revoked by the workspace owner."
};
type EnvelopeItem = {
  seq: number;                           // API arrival order, starts at 1
  digest: Hex;
  envelope: Hex;
  status: 'pending' | 'anchored' | 'rejected';
  index: number | null;                  // on-chain position once anchored
  txHash: Hex | null;
  blockNumber: number | null;
  receivedAt: string;                    // ISO time
};
```

## Batcher

One loop per registered workspace, every `BATCH_INTERVAL_MS` (default 3000):
1. Take up to 64 `pending` envelopes in `seq` order.
2. Read the on-chain count and head, then call `appendBatch(wsId, count, head, digests)`.
3. On success, mark each envelope `anchored` with its `index`, `txHash` and `blockNumber` from the `Appended` events.
4. On `StaleCount` or `StaleHead` (another writer, for example the owner, appended first): reread and retry, at most 3 attempts per tick, then wait for the next tick.
5. On `NotWriter`: set `writerState = 'revoked'`, mark every pending envelope `rejected`, set `lastError`, and stop that workspace's loop. No retry loop.
6. On transport errors: keep the envelopes `pending`, set `lastError`, and retry on the next tick.

## Shutdown

On SIGTERM or SIGINT the API stops listening, closes every open connection (including browser preconnections that never sent a request), stops the batchers and closes SQLite, then exits 0. If chain I/O is still pending after 500 ms, it logs "Vendor A shutdown was forced after 500 ms; chain I/O did not finish." and exits 1. Nothing is lost: envelopes stay `pending`, and a batch that was already submitted keeps its recorded tx hash, which the next start reconciles before resending.

## Configuration (env, validated with Zod)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `DATABASE_PATH` | `data/vendor-api.sqlite` | `node:sqlite` file (gitignored `data/`) |
| `PACKOUT_NETWORK` | `localhost` | `localhost` or `portaldotTestnet`. Selects the RPC and `contracts/deployments/<network>.json` |
| `PORTALDOT_EVM_RPC` | testnet URL | RPC for `portaldotTestnet` |
| `VENDOR_WRITER_PRIVATE_KEY` | Hardhat dev account #1 on localhost | vendor writer key; required on testnet |
| `CORS_ORIGIN` | `http://localhost:5173` | Vendor A web origin |
| `BATCH_INTERVAL_MS` | `3000` | batcher tick |
