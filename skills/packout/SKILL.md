---
name: packout
description: Use when adding an exit path to an app on Portaldot with Packout. Covers creating an owner-controlled workspace, encrypting and anchoring operations, exporting a bundle, verifying it against the chain, and taking over authority from a vendor.
---

# Packout integration

Packout lets a team leave a SaaS vendor without losing its workspace. The registry contract on Portaldot holds three facts: who owns a workspace, who may write now, and the ordered history (a head chain of envelope digests). Content is encrypted on the device with a workspace key the vendor never holds.

Use this skill when you are asked to make an app "exit-proof", add export/restore, verify a Packout bundle, or let an owner revoke a vendor's write access.

## Ground rules

1. **The workspace key never leaves the client.** Do not send it to a server, log it, or put it in a query string. Invite links carry it in the URL fragment (`#`), which browsers do not send.
2. **Members need no wallet.** Only the owner signs `createWorkspace`, `grantWriter`, `rotateEpoch`. A vendor writer key anchors members' operations.
3. **The chain is the referee, not storage.** Only digests and the head go on-chain. Encrypted envelopes live with the vendor, on devices, and in bundles.
4. **Never claim finality early.** A receipt is "included". Wait for the finalized height before saying "finalized" (`waitForFinalized`).
5. **Money and chain values are `bigint`.** Native Portaldot units have 14 decimals, EVM units 18 (`NativeToEthRatio = 10000`). Convert only with `nativeToEvm` / `evmToNative`.
6. **Never invent API.** If a function below does not exist in the installed `@packout/sdk`, read its `dist/*.d.ts` and adapt.

## Network facts (verified on 2026-10-29 to 2026-11-01)

- Portaldot testnet EVM RPC `https://test-evm-rpc-v3.portaldot.dev`, chain ID `420420777`.
- Registry on testnet: `0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0` (deployed in block 238168). Read `contracts/deployments/portaldotTestnet.json` in the Packout repo for the current record.
- Test tokens (tPOT) pay gas. Storage deposits dominate cost, so keep on-chain state minimal.

## Recipe

Install: `npm i @packout/sdk viem`.

```ts
import {
  createBundle, createOp, createRegistryReader, createRegistryWriter, envelopeDigest,
  generateWorkspaceKey, JOURNAL_SCHEMA_ID, sealOp, serializeBundle, verifyBundle, workspaceId,
} from '@packout/sdk';
```

1. **Create the workspace (owner wallet).** `createRegistryWriter({ wallet, client, registry }).createWorkspace(salt, JOURNAL_SCHEMA_ID)` returns `{ wsId, hash, blockNumber }`. `workspaceId(owner, salt)` computes the same id off-chain.
2. **Generate the key on the client.** `const key = generateWorkspaceKey()`. Store it where the owner controls it. Show it once or offer a download.
3. **Grant the vendor writer.** `writer.grantWriter(wsId, vendorWriterAddress)`.
4. **Write.** Per change: `createOp({ wsId, author: { memberId, name }, type: 'issue.create', body: { title, description } })` (other types: `issue.setStatus`, `comment.add`), then `sealOp(op, key)` gives the encrypted envelope and `envelopeDigest(envelope)` its digest. The vendor appends digests with `appendBatch(wsId, expectedCount, expectedHead, digests)`. A stale count or head reverts, so refetch with `reader` and retry.
5. **Export.** `createBundle({ wsId, schemaId, envelopes, ... })` then `serializeBundle(bundle)` gives a `packout.bundle/1` file. Check the exact input fields in `bundle.d.ts`.
6. **Verify.** `await verifyBundle({ bundle, key, chain: createRegistryReader({ client, registry }) })` returns a report with six steps: `format`, `envelopes`, `head`, `anchored`, `complete`, `decrypt`. Show each step with a human sentence. A failed step must block continuing and must say what is wrong. A bundle that is missing operations fails `complete`; that is the correct result, not a bug.
7. **Take over.** Owner calls `rotateEpoch(wsId, [])` (or with the new app's writer list). It revokes every prior writer in one transaction. Afterwards the old vendor's `appendBatch` reverts with `NotWriter`.

## Verify without the SDK

`npx @packout/verify bundle.json --key key.txt` is an independent implementation written from the format spec. Exit code `0` passed, `1` failed, `2` bad arguments. Without `--key` it runs five checks and reports decryption as skipped. Add `--json` for machine-readable output and `--rpc <url>` to choose the endpoint.

## UX requirements for any app you build

- Show each chain action's real state: preparing, waiting for wallet, submitted, included, finalized, failed with a plain reason. Show the transaction hash and explorer link.
- Show where each write lives: on this device, on the vendor, anchored on Portaldot.
- Never show placeholder or simulated data as real. Testnet values are labelled testnet.

## Boundaries (state these honestly)

- Revocation stops future writes. It cannot erase what a vendor already decrypted. The vendor never holds the key, which limits that.
- Restore trusts a named RPC endpoint. This is not light-client verification.
- A Safe with a recovery module can reach a similar succession outcome on other EVM chains. Do not present native Recovery as unique to Portaldot without that qualifier.

## Where to read more

Packout repo: `docs/technical/ARCHITECTURE.md` (components, head-chain formula), `docs/technical/SMART-CONTRACT.md` (contract, deployments, tx hashes), `docs/technical/INTEGRATIONS.md` (Portaldot facts).
