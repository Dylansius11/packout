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
| `SUCCESSION_W_MNEMONIC` | F9 spike and `demo:succession` (BUILD-PLAN 10.1, 10.2) | sr25519 mnemonic of the dedicated workspace-authority account W (section 6). Testnet only, never a personal wallet |

E2E (`pnpm e2e`) runs its own stack on ports 8645 (chain), 8887 (API) and 5273 (Vendor A), and never reads `.env`.

## 5. GitHub Actions secrets

Set on `Dylansius11/packout` only for the manual testnet smoke workflow (BUILD-PLAN 6.2): `DEPLOYER_PRIVATE_KEY`, `VENDOR_WRITER_PRIVATE_KEY`. Push CI uses a local chain and needs no secrets.

Trigger the manual-only smoke with `gh workflow run testnet-smoke.yml`: it runs `pnpm smoke:testnet` against the committed `contracts/deployments/portaldotTestnet.json` (fails if missing, never deploys) and uploads only `evidence.json` and `run-output.txt`, never the workspace key.

## 6. Native succession (PRD F9, BUILD-PLAN 10.0)

Read-only prep, 2026-10-26. Labels: [V] observed (raw requests and responses are kept in the gitignored `scratch/research/succession/`, with the full report in `scratch/research/succession-prep.md`), [I] inference, [U] unverified until the funded spike (10.1). Nothing below has been signed or submitted.

### 6.1 Pin

| | Item | Value |
| --- | --- | --- |
| [V] | Block | finalized #199540 `0xa654fd27a3711855e38f7bce1f31c91c26390eba719391b7cdf5553eea25de09` |
| [V] | Runtime | `portaldot-v3`, spec 3002, transaction version 2 |
| [V] | Metadata | v16 from `Metadata_metadata_at_version(16)`, 640,746 bytes, blake2_256 `0x8e34715899853d7ff6a2ca16c62c490a3474bc4ac2f319025672c8d092567ec2`. `state_getMetadata` returns v14, whose type ids differ: always decode with v16 |
| [V] | Native HTTP RPC | `https://test-node-v3.portaldot.dev` answers JSON-RPC over POST, as well as WSS |

### 6.2 Calls used

| | Call | Index | Arguments (wire order) |
| --- | --- | --- | --- |
| [V] | `Recovery.control_inherited_account` | 30/0 | `recovered: MultiAddress`, `call: RuntimeCall` |
| [V] | `Recovery.set_friend_groups` | 30/2 | `Vec<FriendGroup { friends: Vec<AccountId32>, friends_needed: u32, inheritor: AccountId32, inheritance_delay: u32, inheritance_priority: u32, cancel_delay: u32 }>` |
| [V] | `Recovery.initiate_attempt` / `approve_attempt` / `finish_attempt` / `cancel_attempt` | 30/3, 30/4, 30/5, 30/6 | `lost: MultiAddress`, `friend_group_index: u32` |
| [V] | `Recovery.revoke_inheritor` / `slash_attempt` | 30/1, 30/7 | none / `friend_group_index: u32` |
| [V] | `Revive.call` | 80/1 | `dest: H160`, `value: Compact<u128>`, `weight_limit: Weight`, `storage_deposit_limit: Compact<u128>` (not optional on the extrinsic), `data: Vec<u8>` |
| [V] | `Multisig.as_multi` / `approve_as_multi` | 36/1, 36/2 | standard pallet-multisig arguments (only used if D11 switches to a Multisig inheritor) |
| [V] | `Revive.map_account` | 80/7 | exists but is disabled because `AutoMap = true`; never call it |

Encoded example: `rotateEpoch(bytes32,address[])` has selector `0x600bc59f`.

Three Recovery facts change the flow:

- [V] Threshold approval does not install the inheritor. Someone must call `finish_attempt`; `initiate_attempt` counts as the initiator's approval.
- [V] `control_inherited_account` cannot dispatch Recovery calls.
- [I] Upstream, `control_inherited_account` returns `Ok` even when the inner call fails, and reports the result in a `RecoveredAccountControlled` event. Gate evidence must therefore read that event plus the registry's epoch, never just extrinsic success.

### 6.3 Native account → EVM caller

| | Finding |
| --- | --- |
| [V] | For a non-eth-derived AccountId32, `ReviveApi_address(W)` equals `keccak256(W)[12..32]`. Checked by the prep run and again by the lead with a random account at block #199677. |
| [V] | **Decisive dry run.** `ReviveApi_instantiate` with origin = a native account and initcode `0x335f5260205ffd` (CALLER, PUSH0, MSTORE, PUSH1 0x20, PUSH0, REVERT) reverts with exactly `H160(origin)` left-padded. Seen in 8 prep runs, plus the lead's independent run with a fresh random account. The EVM `msg.sender` of a native-origin Revive execution is `H160(W)`. |
| [V] | The reverse lookup `ReviveApi_account_id(H160(W))` returns `H160(W) ‖ 0xEE×12`, not W, while `OriginalAccount(H160(W))` is empty. Never send funds to that EE-padded account for W. |
| [I] | AutoMap should insert `OriginalAccount(H160(W)) = W` once W is funded. Dry runs map in an overlay, so they cannot rule out an `AccountUnmapped` refusal on a real extrinsic: [U] until 10.1. |
| [V] | `DryRunApi_dry_run_call` is not exported by this runtime, so the nested Recovery → Revive dispatch cannot be simulated. |
| [I] | Consequence: W can call `createWorkspace` through native `Revive.call` and becomes owner `H160(W)` with no contract change and no ownership transfer. This holds only if the real dispatch behaves like the dry run: [U] until 10.1. |

The workspace-authority account W for the spike was generated on 2026-10-26 into `.env` as `SUCCESSION_W_MNEMONIC`:

- SS58 `5D5Qw6HsJ7wK4APZF9TfqTSP5omBtLE1uF9YFgYyk1jLj9zE`
- AccountId32 `0x2cc6822be14672b63885d372e8075f32409d6bc722448897098a7aa1a4e09929`
- `H160(W)` = `0x2d313fc3e31a90b4a23f0e4b15a7c37817d70dd1`, confirmed by `ReviveApi_address`

### 6.4 Deposits, fees and funding

| | Item | Amount |
| --- | --- | --- |
| [V] | Existential deposit | 0.1 tPOT per account |
| [V] | `Recovery.SecurityDeposit` | 0 |
| [I] | Recovery storage considerations | Metadata types the friend-group, attempt and inheritor tickets as `()`, which upstream treats as no hold. Hold: 0 [U] |
| [V] | Fee quotes (`TransactionPaymentApi_query_info`, fake-signed) | `set_friend_groups` 0.0254, initiate/approve/finish/cancel ≈ 0.0145, `control_inherited_account` + `rotateEpoch` 0.0338, native `Revive.call` createWorkspace 0.0271 and appendBatch 0.0399 tPOT |
| [I] | W's workspace storage | 4 new slots (owner/epoch/count, schemaId, head, one writer flag) at 64 bytes × 0.06 + 0.15 = 15.96 tPOT, a conservative upper bound until measured |
| [V] | Multisig inheritor | 5.43 + 1.92 × 2 = 9.27 tPOT held per pending operation |

**Extra funding (single-key inheritor, D11): 18.5 tPOT to W** (`5D5Qw6HsJ7wK4APZF9TfqTSP5omBtLE1uF9YFgYyk1jLj9zE`).

| Account | Allocation |
| --- | --- |
| W | keeps ~17 |
| N | 0.4, forwarded by W at spike start |
| Backups | 0.2 each (three backups), forwarded by W at spike start |
| Forwarding transfers | fee headroom |

This is a conservative plan with about 2× fee headroom, not a measured cost. A Multisig inheritor would need 27.4 tPOT. Neither figure covers the registry deploy, which is already in B1.

### 6.5 Timing

- [V] Blocks are 6 s: `Babe.ExpectedBlockTime` 6000 ms, and 6000.2 ms was measured over 10 blocks.
- [V] Recovery delays count blocks from `Recovery.provided_block_number`, which matched the native block number.
- [I] Upstream allows `inheritance_delay = 0` and requires `cancel_delay ≥ 1`.
- Working demo value (D13): 10 blocks (~60 s) each, labelled on screen as a test delay.
- W can cancel an attempt at any time.

### 6.6 What only the funded spike can prove

All of the following are [U]:

- AutoMap installs `OriginalAccount(H160(W)) = W` on funding.
- A real `Signed(W)` `Revive.call` to `createWorkspace` / `appendBatch` finalizes with owner `H160(W)`.
- The 2-of-3 → delay → `finish_attempt` → `control_inherited_account(W, Revive.call(rotateEpoch))` path finalizes, the inner result succeeds and the epoch changes.
- The failure paths behave as expected: 1-of-3 gives `NotApproved`, early dispatch gives `NotYetInheritable`, W cancels, and the vendor gets `NotWriter`.
- The real holds and fees, and who pays the storage deposit (W or N) on an inherited call.
- The live runtime's limits on friend groups and delays.
