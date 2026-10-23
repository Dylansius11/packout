# PACKOUT: Lessons

Read the headlines before starting work. Format: `### YYYY-MM-DD: headline`, then what happened, root cause, rule going forward. Newest on top.

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
