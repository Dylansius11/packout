# PACKOUT: Lessons

Read the headlines before starting work. Format: `### YYYY-MM-DD: headline`, then what happened, root cause, rule going forward. Newest on top.

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
