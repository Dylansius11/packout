# PACKOUT: Open decisions and blockers

Rows marked `owner: founder` are never decided by an agent. Close a row with the resolution and the commit that resolved it. Newest rows at the bottom of each table.

## Blockers

| Id | Item | Owner | Status | Resolution / commit |
| --- | --- | --- | --- | --- |
| B1 | Fund testnet keys: deployer `5GEy3B5b8LhcwUf2tD9wMmhmJrLgV272jpvWTxwbEZvJ3NsV` (about 600 tPOT, code deposit dominates) and vendor writer `5EMHXSkuyeDhMMVft4oZagVoRmJ8KZF2RhxqgdxiCYuEYMu5` (about 50 tPOT). See INTEGRATIONS.md section 2. Blocks BUILD-PLAN 1.4 and 1.5. | founder | open | Requested 2026-10-23. Balances were `0x0` at request time. |
| B2 | Record the check-in video (3 min max) and submit the DoraHacks check-in before 2026-10-24 12:00 UTC. The lead supplies the script and every field's text. | founder | open | |

## Decisions

| Id | Item | Owner | Status | Resolution / commit |
| --- | --- | --- | --- | --- |
| D1 | Solidity version and EVM target that deploy on Portaldot | lead | open | Read-only probe: 0.8.28 and 0.8.38 with `paris`, `cancun` and `prague` all pass creation dry runs. Working choice 0.8.28 + `cancun`; pin after the real deploy (BUILD-PLAN 1.4). |
| D2 | TypeScript 7 or fallback 5.9.3 (Hardhat, Vite, Vitest compatibility) | lead | resolved | TypeScript 7.0.2 everywhere. Native `tsc` typechecks, Vitest 5 runs, Hardhat 3 compiles and runs viem tests (its loader uses `tsx`, not the TS compiler API). Vite app build not yet exercised. Resolved in `chore(repo): scaffold pnpm monorepo`. |
| D3 | Workspace id: caller-chosen or derived | lead | resolved | Derived: `wsId = keccak256(abi.encode(owner, salt))` to stop front-run squatting. SMART-CONTRACT.md section 1. Same commit as this file. |
| D4 | Who signs Client B writes after takeover: the owner wallet directly, or a Client B writer key authorized by `rotateEpoch` | lead | open | Default: owner wallet (always allowed, no extra key to fund). Decide by Phase 5. |
| D5 | Hosting for vendor-api, vendor-a and client-b during the real testnet demo | founder | open | Needed by Phase 7. Paid services need founder approval. |
| D6 | `eth_getLogs` strategy (range limits on Portaldot RPC) | lead | resolved | Full-range queries filtered by address and topics from the deployment block; bisect any response of 10,000 rows (possible silent upstream cap). Evidence in INTEGRATIONS.md section 1.1. Resolved in `docs(integrations): record Portaldot RPC behavior`. |
| D7 | Office hours application, closes 2026-10-27 12:00 UTC | founder | open | Lead drafts the questions. |
| D8 | Visual references for DESIGN.md | founder | open | Not needed before check-in. Blocks BUILD-PLAN 8.1. |
| D9 | F8 second replica location for envelopes | lead | open | Stretch, only after Phase 7. |
| D10 | How the demo proves "Portaldot rejects the vendor's comeback write": a simulation revert (`NotWriter` from `eth_call`, no tx) or a mined reverted tx with a hash | lead | resolved | Both. The apps keep simulating first, so users see the `NotWriter` reason without paying for a doomed tx. The headless `pnpm demo:full` script force-sends one vendor append after takeover (gas taken from an earlier successful append), leaving a reverted tx on the explorer as public evidence. |
