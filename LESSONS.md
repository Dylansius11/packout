# PACKOUT: Lessons

Read the headlines before starting work. Format: `### YYYY-MM-DD: headline`, then what happened, root cause, rule going forward. Newest on top.

### 2026-10-29: The Portaldot testnet can stop producing blocks for hours
- What happened: the founder's 500 tPOT transfer sat "pending" for over 13 hours, and a resubmit failed with `1014 Priority is too low`.
- Root cause: no block was authored between #232,115 (2026-10-28 12:45:54 UTC) and #232,116 (2026-10-29 02:09:54 UTC), 8,040 slots and 14 BABE epochs later. The runtime was unchanged (spec 3002). The testnet has only 2 block authors, and the first block after the gap ran the staking election and a new session. The tx stayed in the pool and landed in #232,117. The 1014 error only meant an identical copy (same nonce, same tip) was already queued.
- Rule: before blaming a wallet or a script, compare the best block's timestamp with the wall clock. Never resubmit while the first copy is pending. Keep the recorded backup run (BUILD-PLAN 7.3), because the live demo cannot survive an outage like this.

### 2026-10-29: Most of the testnet cost is storage deposit, and it is all paid once
- What happened: the deploy cost 252.73 tPOT (252.41 of it code deposit, quoted exactly by a `ReviveApi_instantiate` dry run). createWorkspace cost 7.70, grantWriter 3.86 and the first append 3.88, while later appends and `rotateEpoch` cost 0.02 to 0.03.
- Root cause: pallet-revive charges the deposit inside the gas figure when a call creates storage; updating existing slots only pays the fee.
- Rule: quote a funding request from a dry run's `storageDeposit`, not from per-byte arithmetic. The earlier "about 600 tPOT" guess was more than double the real cost.

### 2026-10-27: Portaldot's v16 metadata hash changes without a runtime upgrade
- What happened: the succession preflight refused the live chain because the raw blake2_256 of v16 metadata no longer matched the 2026-10-26 pin, while spec 3002 and transaction version 2 were unchanged.
- Root cause: comparing the pinned and live metadata found exactly one difference, the storage `fallback` of `Revive.EthBlockBuilderIR`, which embeds block-builder state.
- Rule: pin the snapshot hash and the runtime versions, then compare live metadata structurally while excluding only that named fallback. Never weaken the pin to "spec version only". Pass `tx.toU8a()`, not a hex string, to the decorated `queryInfo` runtime call; the hex form traps in WASM.

### 2026-10-26: Portaldot's default metadata is v14 and its type ids do not match v16
- What happened: during the Succession prep, call decoding failed until the decoder switched to v16 metadata.
- Root cause: `state_getMetadata` returns v14, while `@polkadot/api` initializes from `Metadata_metadata_at_version(16)`. The two portable registries number their types differently.
- Rule: pin native metadata from `Metadata_metadata_at_version(16)`, record its blake2_256 hash, and never mix type ids across versions. For native dry runs, `ReviveApi_*` exists but `DryRunApi_dry_run_call` does not, so a nested Recovery → Revive dispatch can only be proven with a funded transaction.

### 2026-10-23: `child.kill('SIGTERM')` behaves differently on Windows and Linux
- What happened: the browser demo passed on Windows but timed out on the Linux runner while stopping the vendor API.
- Root cause: on Windows, `kill` terminates the process immediately. On Linux, SIGTERM runs vendor-api's graceful shutdown, where `server.close()` waited forever on Chromium's speculative preconnections: TCP sockets that never send an HTTP request, so Node never treats them as idle. A follow-up slip, `children.map(stopChild)`, also passed the array index in as the grace period.
- Rule: HTTP servers call `closeAllConnections()` after `close()` and put a deadline on shutdown. Anything that stops a process escalates to SIGKILL after a logged grace period. Process-lifecycle behavior counts as verified only on Linux (CI or WSL). Never pass a function with optional parameters straight to `map`.

### 2026-10-23: Hardhat mines a reverted tx but answers `eth_sendRawTransaction` with an error
- What happened: `pnpm demo:full:local` force-sent a vendor append after takeover. Hardhat mined it as reverted, but the RPC call returned only revert data, with no tx hash.
- Root cause: Hardhat's automine reports the revert synchronously as an RPC error. Portaldot's behavior is UNVERIFIED.
- Rule: never guess or parse a hash from error text. Read it from the error's structured data, or find the mined tx by sender, nonce, destination and exact calldata, then confirm its receipt is `reverted`.

### 2026-10-23: Sorting by "least final" still needs a deterministic tie-break
- What happened: Playwright failed 2 of 4 runs because an issue badge showed `Anchored #0` where `#2` was expected.
- Root cause: several anchored ops tied on rank, so the first one in IndexedDB order won, and that order follows random op ids.
- Rule: any reducer that picks one item from a set must break ties explicitly (here: highest anchored index), and needs a test that feeds both orders.

### 2026-10-23: Two viem copies break `instanceof` across packages
- What happened: contract reverts from a client built in `contracts/` were not recognized as viem `BaseError` inside `@packout/sdk`.
- Root cause: pnpm installed viem twice, once per peer-dependency context (zod). The versions match, but the class identities differ.
- Rule: never use `instanceof` on library error classes across package boundaries. Walk `Error.cause` and match on `name` and decoded data instead.

### 2026-10-23: Hardhat 3.21 emits artifact typings that TypeScript 7 rejects
- What happened: once contracts compiled, `tsc` failed on every generated `artifacts/**/artifacts.d.ts` with `TS1036: Statements are not allowed in ambient contexts`.
- Root cause: Hardhat's declaration generator closes each artifact interface with `};`. The stray `;` is an empty statement, which TypeScript 7 refuses in a `.d.ts`.
- Rule: keep the one-character fix as a pnpm patch (`patches/hardhat@3.21.0.patch`, registered in `pnpm-workspace.yaml`). Drop it once Hardhat ships the fix. Never use `skipLibCheck` or exclude the artifacts, because viem's typed reads depend on them.

### 2026-10-23: On Portaldot, a passing dry run says nothing about funding, and gas numbers are not Ethereum gas
- What happened: creation `eth_call` and `eth_estimateGas` succeeded from a zero-balance address, with estimates around 3.4 × 10^15. A storage-writing call from the same address failed with `StorageDepositNotEnoughFunds`.
- Root cause: pallet-revive folds weight and storage deposit into one gas scalar and only charges the deposit on real execution.
- Rule: check `eth_getBalance` before any testnet write, pass the RPC estimate through unchanged as `bigint`, and never hard-code an Ethereum-style gas limit.

### 2026-10-23: The Portaldot explorer cannot open an EVM tx hash
- What happened: searching a real EVM tx hash on scanner-testnet-v3 opened an empty account page.
- Root cause: the explorer is a native Substrate UI keyed by block and extrinsic index.
- Rule: link EVM txs to their block page and print the hash beside it; never present a hash search link as proof.

### 2026-10-23: TypeScript 7 works with Hardhat 3 and Vitest 5, but viem's types need DOM libs
- What happened: `tsc` 7.0.2 failed on viem's `ox` dependency (`TS2749: 'CryptoKey' refers to a value`, missing `AuthenticatorAttestationResponse`).
- Root cause: `ox` declarations reference WebCrypto and WebAuthn browser types; a Node-only `lib` does not have them.
- Rule: `tsconfig.base.json` keeps `DOM` and `DOM.Iterable` in `lib`. Never silence it with `skipLibCheck` or a TS downgrade.

### 2026-10-23: pnpm 12 and Biome 2.6 changed defaults
- What happened: `pnpm install` failed with `ERR_PNPM_IGNORED_BUILDS` for esbuild, and installed packages younger than the release-age window were refused. Biome 2.6 started formatting Markdown and rejected the hand-written doc tables.
- Root cause: pnpm 12 blocks dependency build scripts and very new releases by default; Biome 2.6 added Markdown and YAML formatting.
- Rule: approve builds narrowly in `pnpm-workspace.yaml` `allowBuilds` (exact version), list exact versions in `minimumReleaseAgeExclude` only when needed, and keep `**/*.md` out of Biome.

### 2026-10-23: Hardhat 3 does not read `.env`
- What happened: `configVariable('DEPLOYER_PRIVATE_KEY')` needs the variable in the process environment.
- Root cause: Hardhat 3 dropped implicit dotenv loading.
- Rule: contracts scripts run Hardhat through `node --env-file-if-exists=../.env`; no dotenv dependency.

### 2026-10-23: The Portaldot mapped account can be computed, no console needed
- What happened: funding an EVM key needs the native `5…` address mapped to it. The guide only shows the node console runtime call.
- Root cause: with `AutoMap = true`, `reviveApi.accountId(h160)` returns the H160 followed by twelve `0xEE` bytes. Encoding that as SS58 with prefix 42 reproduces the guide's own example exactly.
- Rule: compute mapped addresses in code (`ss58(42, h160 ‖ 0xEE×12)`), and still confirm funding with `eth_getBalance` before any deploy.
