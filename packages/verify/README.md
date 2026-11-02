# @packout/verify

Independent PACKOUT bundle v1 verifier, implemented from the open format spec.
It checks bundle format, envelope digests, the head chain, on-chain admission and
completeness, plus local decryption when a workspace key is supplied. It does not
use `@packout/sdk` at runtime. Requires Node.js 24 or newer.

## Install and run

```sh
npm i @packout/verify
npx packout-verify bundle.json
```

Or run the package directly:

```sh
npx @packout/verify bundle.json [--key key.txt] [--json]
```

Square brackets indicate optional arguments, not literal shell input. For example:

```sh
npx @packout/verify bundle.json --key key.txt --json
```

The key file must contain the 32-byte workspace key as unpadded base64url. Without
a key, decryption is reported as skipped. `--json` emits a machine-readable report;
`--rpc <http(s) URL>` selects the trusted EVM RPC endpoint. Verification trusts the
selected RPC, not a light-client proof.

For mixed native/EVM history, use `--native-blocks native-blocks.json`; this public
JSON array of block hashes is a lookup hint, not proof. `--native-rpc <url>` selects
a native HTTP(S) or WS(S) endpoint. Keep keys separate from public bundles and hints.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Verification passed |
| `1` | Verification failed |
| `2` | Bad arguments |

A stale bundle fails completeness if the on-chain workspace has newer operations.
This is an expected verification failure, not a CLI crash.

## Documentation

- [Repository and root CLI guide](https://github.com/Dylansius11/packout#readme)
- [Open bundle format and verification rules](https://github.com/Dylansius11/packout/blob/main/docs/technical/ARCHITECTURE.md)
- [Chain and native-history integration](https://github.com/Dylansius11/packout/blob/main/docs/technical/INTEGRATIONS.md)

MIT; see [LICENSE](./LICENSE).
