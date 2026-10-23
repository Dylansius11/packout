# Integrations and manual configuration

## 1. Portaldot testnet v3

| Item | Value |
| --- | --- |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| EVM chain id | `420420777` (`0x190f1ca9`, observed 2026-10-23) |
| Native RPC (WSS) | `wss://test-node-v3.portaldot.dev` |
| Node console | https://node-console.portaldot.dev |
| Explorer | https://scanner-testnet-v3.portaldot.dev |
| Token | `tPOTv3`; native 14 decimals, EVM 18 decimals, `NativeToEthRatio = 10000` |
| Runtime | `portaldot-v3`, spec 3002, pallet-revive with eth-rpc proxy |
| Official guide | https://github.com/ItsCogumellum/portaldot-v3-testnet-guide |

### 1.1 RPC behavior (read-only probe, 2026-10-23)

Evidence: raw requests and responses kept under `scratch/research/` during the probe; summary here.

| Topic | Observed | Consequence for PACKOUT |
| --- | --- | --- |
| Methods | `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber` (`latest`, `safe`, `finalized`), `eth_gasPrice` (`0x83fe`), `eth_maxPriorityFeePerGas` (`0x0`), `eth_feeHistory`, `eth_estimateGas`, `eth_call`, `eth_getLogs`, `eth_getCode`, `net_version`, `eth_syncing` all answered | Standard viem clients work |
| Bytecode | creation `eth_call` and `eth_estimateGas` succeed for solc 0.8.28 and 0.8.38 with `paris`, `cancun` (and `prague` on 0.8.38) | Plain EVM Hardhat tooling, not the PVM/resolc plugin |
| Gas | estimates are huge scalars (about 3.4 × 10^15 for a small creation) that cover weight and storage deposit | Use the RPC estimate unchanged as `bigint`; never clamp to Ethereum gas limits |
| Affordability | an unfunded sender can dry-run a creation; a storage-growing call fails with `StorageDepositNotEnoughFunds` | A passing dry run proves nothing about funding; check balance first |
| Tx types | historical legacy (type 0) and EIP-1559 (type 2) receipts observed | Start with legacy txs at live `eth_gasPrice` |
| Blocks | about 6 s; `finalized` trails `latest` by 2–3 blocks | Show "finalized" only after the receipt block is at or below `finalized` |
| `eth_getLogs` | genesis to latest (156,714 blocks) returned 301 logs in 939 ms; no range rejection. Upstream eth-rpc silently caps a query at 10,000 rows (applicability to this build UNVERIFIED) | Always filter by address and topics from the deployment block; bisect any query that returns 10,000 rows |

### 1.2 Explorer links

The explorer is a native (Statescan-style) UI:

| Target | URL template | Status |
| --- | --- | --- |
| Block | `https://scanner-testnet-v3.portaldot.dev/#/blocks/{decimalBlockNumber}` | verified |
| Native account | `https://scanner-testnet-v3.portaldot.dev/#/accounts/{ss58}` | verified |
| Extrinsic | `https://scanner-testnet-v3.portaldot.dev/#/extrinsics/{block}-{extrinsicIndex}` | verified for native txs |
| EVM tx hash / H160 address | none | searching an EVM tx hash opens an empty account page |

Until an EVM-tx route is proven, PACKOUT links each EVM tx to its block page and prints the tx hash next to it.

## 2. Funding an EVM key

Portaldot pays EVM gas and storage deposits from the native account mapped to the H160 address. With `AutoMap = true` the mapped account is the H160 followed by twelve `0xEE` bytes, shown as SS58 with prefix 42. Do not call legacy `map_account`.

1. Derive the mapped address. Either use the node console (**Developer → Runtime calls → reviveApi → accountId**), or compute `ss58(42, h160 ‖ 0xEE×12)`. The computed form matches the guide's example (`0xf7eC…4142` → `5Hfmuhj1…to8Y`, checked 2026-10-23).
2. Send tPOT to that `5…` address from a funded native account (node console → Accounts → Send).
3. Confirm with `eth_getBalance(<h160>, "latest")`, which reports EVM units (wei, 18 decimals).

Test tokens come from the organizer to the native `5…` address registered for the hackathon. If none arrived, open a Portaldot Discord support ticket with a screenshot of the hackathon registration and the native address (Discord admin `@titus242471`, DoraHacks `@Stella707827`).

Project keys (addresses only; private keys live in `.env`):

| Role | EVM address | Mapped native address (fund this) |
| --- | --- | --- |
| Deployer / demo owner | `0xb8c47dfB101938a0F57011aEf6EF5cC2CE97D859` | `5GEy3B5b8LhcwUf2tD9wMmhmJrLgV272jpvWTxwbEZvJ3NsV` |
| Vendor A writer | `0x651dBB5965c6538AbC4027bEFAc3523FF28fF1a0` | `5EMHXSkuyeDhMMVft4oZagVoRmJ8KZF2RhxqgdxiCYuEYMu5` |

These are disposable testnet keys. Never reuse them on a network with real value.

## 3. Wallets

Only the owner needs a wallet: an injected EVM wallet (MetaMask or compatible) on the network in section 1. Members write without a wallet; the vendor's writer key anchors their ops.

MetaMask network settings: name `PortaldotV3 Testnet`, RPC `https://test-evm-rpc-v3.portaldot.dev`, chain id `420420777`, symbol `tPOTv3`.

## 4. Environment variables

Copy `.env.example` to `.env` at the repo root. Never commit `.env`.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DEPLOYER_PRIVATE_KEY` | contracts deploy, `demo:checkin`, smoke | owner/deployer key on testnet |
| `VENDOR_WRITER_PRIVATE_KEY` | vendor-api batcher, `demo:checkin` | Vendor A's writer key on testnet. Ignored on `localhost`, where Hardhat dev account #1 is always used |
| `PORTALDOT_EVM_RPC` | everything that talks to the chain | defaults to the testnet EVM RPC |
| `PACKOUT_NETWORK` | vendor-api | `localhost` or `portaldotTestnet` (see VENDOR-API.md for the API's own settings) |
| `LOCAL_RPC_URL` | contracts `localhost` network, vendor-api | local chain URL, default `http://127.0.0.1:8545` |
| `PACKOUT_DEPLOYMENTS_DIR` | deploy script, vendor-api | where `<network>.json` is written and read; default `contracts/deployments/`. E2E points it at a temp dir so it never overwrites a developer's `localhost.json` |
| `VITE_PACKOUT_NETWORK`, `VITE_VENDOR_API_URL`, `VITE_LOCAL_RPC_URL` | vendor-a (client-b without the vendor URL) | build-time network, API URL and local chain URL |
| `VITE_PACKOUT_DEPLOYMENT` | vendor-a | build-time deployment JSON that overrides `contracts/deployments/<network>.json` (used by E2E) |

E2E (`pnpm e2e`) runs its own stack on ports 8645 (chain), 8887 (API) and 5273 (Vendor A), and never reads `.env`.

## 5. GitHub Actions secrets

Set on `Dylansius11/packout` only for the manual testnet smoke workflow (BUILD-PLAN 6.2): `DEPLOYER_PRIVATE_KEY`, `VENDOR_WRITER_PRIVATE_KEY`. Push CI uses a local chain and needs no secrets.

Trigger the manual-only smoke with `gh workflow run testnet-smoke.yml`: it runs `pnpm smoke:testnet` against the committed `contracts/deployments/portaldotTestnet.json` (fails if missing, never deploys) and uploads only `evidence.json` and `run-output.txt`, never the workspace key.
