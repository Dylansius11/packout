# @packout/sdk

PACKOUT's workspace exit kit for Portaldot: deterministic operation encoding,
XChaCha20-Poly1305 encryption, head chains, bundle import/export and verification,
journal reduction, and registry readers and writers. Requires Node.js 24 or newer;
the package ships ESM JavaScript and TypeScript declarations.

## Install

```sh
npm i @packout/sdk
```

## Minimal usage

```js
import { canonicalJson, envelopeDigest } from '@packout/sdk';

const encoded = new TextEncoder().encode(canonicalJson({ title: 'Exit-ready', v: 1 }));
console.log(envelopeDigest(encoded)); // keccak256 of the supplied bytes (0x-prefixed hex)
```

`canonicalJson` sorts object keys recursively and accepts only safe integers for
numbers. `envelopeDigest` hashes bytes; the example is a deterministic hashing
example, not an encrypted workspace operation. Use `createOp`, `generateWorkspaceKey`
and `sealOp` to construct encrypted journal operations.

## Native history (opt-in)

The main entry uses EVM reads. For mixed native/EVM history, install the optional
peer dependency explicitly and import the separate entry:

```sh
npm i @polkadot/api@17.0.2
```

```js
import { createNativeRegistryReader } from '@packout/sdk/native';
```

The native reader requires a caller-owned initialized `ApiPromise`, the EVM
reader options and public native block-hash hints. It does not own the native
connection's lifetime. `@polkadot/api` is an optional peer and is not needed by
the main entry. `shamir-secret-sharing` remains a required dependency because
the main entry exports workspace-key sharing functions.

## Documentation

- [Repository and runnable reference apps](https://github.com/Dylansius11/packout)
- [Architecture and bundle format](https://github.com/Dylansius11/packout/blob/main/docs/technical/ARCHITECTURE.md)
- [Chain integration and native history](https://github.com/Dylansius11/packout/blob/main/docs/technical/INTEGRATIONS.md)

In the monorepo, exports resolve directly to TypeScript source without a prebuild.
Pack with pnpm: its `publishConfig.exports` override points the packed package to
compiled `dist` JavaScript and declarations; `prepack` builds them first.

MIT; see [LICENSE](./LICENSE).
