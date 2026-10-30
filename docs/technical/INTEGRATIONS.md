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
| Outages | The chain produced no block for 13 h 24 min: block #232,115 at 2026-10-28 12:45:54 UTC, then #232,116 at 2026-10-29 02:09:54 UTC, 8,040 BABE slots later (epoch 388 to 402). The runtime stayed at spec 3002. Block #232,116 carried the staking election and `session.NewSession`, so the two block authors (2 BABE authorities, 2 session validators) were offline and the gap was not a runtime upgrade. Signed txs waited in the pool and landed in #232,117 (for example, extrinsic 232117-5) | Every chain wait has a timeout message. A resubmitted tx with the same nonce and tip fails with `1014 Priority is too low`; that means the first copy is already queued, not that it failed. Keep the backup recording (7.3), because a live demo cannot survive an outage like this |

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

Portaldot pays EVM gas and storage deposits from the native account mapped to the H160 address. For an EVM key, AutoMap makes that account the H160 followed by twelve `0xEE` bytes, shown as SS58 with prefix 42. Do not call legacy `map_account`.

1. Derive the mapped address. Either use the node console (**Developer → Runtime calls → reviveApi → accountId**), or compute `ss58(42, h160 ‖ 0xEE×12)`. The computed form matches the guide's example (`0xf7eC…4142` → `5Hfmuhj1…to8Y`, checked 2026-10-23).
2. Send tPOT to that `5…` address from a funded native account (node console → Accounts → Send).
3. Confirm with `eth_getBalance(<h160>, "latest")`, which reports EVM units (wei, 18 decimals).

**Native sr25519 accounts work the other way round** (observed 2026-10-29):
- A faucet-funded native account already had `OriginalAccount(H160(acct)) = acct` before it ever signed. That H160 is `keccak256(AccountId32)[12..]`.
- An EVM transfer of 25 tPOT from the deployer to that H160 (tx `0x469c73d064127a952a6cbc146279ef80e39a3c5ded88c7d269c12f093be41441`) credited the native account itself.
- An unmapped native account, such as W before its first funding, has no `OriginalAccount`. An EVM transfer to its H160 would credit the `H160 ‖ 0xEE×12` fallback account instead. **Fund W natively (node console → Send), never through its H160.**

Test tokens come from the organizer to the native `5…` address registered for the hackathon. If none arrived, open a Portaldot Discord support ticket with a screenshot of the hackathon registration and the native address (Discord admin `@titus242471`, DoraHacks `@Stella707827`). On 2026-10-29 the founder's faucet wallet sent 500 tPOT natively to the deployer; the lead then sent 30 tPOT by EVM transfer to the vendor writer (`0x477d5e75865b595c314baddbcb8795492f6ab5b8470c7960455a1f8492460bbb`).

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
| `SUCCESSION_N_MNEMONIC`, `SUCCESSION_BACKUP_1_MNEMONIC` … `_3_` | same | the inheritor N and the three backups. `pnpm succession:keys` appends only the missing ones and prints addresses only |
| `PORTALDOT_NATIVE_WSS` | succession scripts | native Substrate endpoint, default `wss://test-node-v3.portaldot.dev` |

E2E (`pnpm e2e`) runs its own stack on ports 8645 (chain), 8887 (API) and 5273 (Vendor A), and never reads `.env`.

## 5. GitHub Actions secrets

Set on `Dylansius11/packout` only for the manual testnet smoke workflow (BUILD-PLAN 6.2): `DEPLOYER_PRIVATE_KEY`, `VENDOR_WRITER_PRIVATE_KEY`. Push CI uses a local chain and needs no secrets.

Trigger the manual-only smoke with `gh workflow run testnet-smoke.yml`: it runs `pnpm smoke:testnet` against the committed `contracts/deployments/portaldotTestnet.json` (fails if missing, never deploys) and uploads only `evidence.json` and `run-output.txt`, never the workspace key.

## 6. Native succession (PRD F9, BUILD-PLAN 10.0)

Read-only prep began 2026-10-26; the funded gate passed 2026-10-30 (SMART-CONTRACT section 9.2). Labels: [V] observed, [I] inference, [U] unverified. Original prep requests/responses are in gitignored `scratch/research/succession/`; live run evidence is in `out/succession/`. Historical dry-run findings below are distinguished from finalized proof in section 6.6.

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
| [V] | At the unfunded prep snapshot, reverse lookup returned `H160(W) ‖ 0xEE×12` while `OriginalAccount(H160(W))` was empty. Never fund that fallback for an unmapped W. |
| [V] | After W's real create/grant on 2026-10-30, AutoMap resolves `H160(W)` back to W. The exact installation trigger was not isolated. A later EVM top-up reached W's native balance only after this mapping was checked. |
| [V] | `DryRunApi_dry_run_call` is not exported by this runtime, so the nested Recovery → Revive dispatch cannot be simulated. |
| [V] | Funded gate: W created the workspace through native `Revive.call` as owner `H160(W)`; N later rotated and appended through Recovery under the same owner (SMART-CONTRACT 9.2). No contract change or ownership-transfer function was needed. |

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

**Extra funding (single-key inheritor, D11): 23 tPOT to W** (`5D5Qw6HsJ7wK4APZF9TfqTSP5omBtLE1uF9YFgYyk1jLj9zE`). The spike needs 18.5. The extra 4.5 covers the later `demo:succession` run, which reuses the spike's workspace and needs 4.5 tPOT plus any recipient shortfalls (6.7) even if the create deposit hits its 16 tPOT cap.

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
- [V] Finality lags the best block by 2 blocks (three samples on 2026-10-27), so each finalized step of the spike takes about 3 blocks.
- [I] Upstream allows `inheritance_delay = 0` and requires `cancel_delay ≥ 1`.
- Working demo value (D13): 10 blocks (~60 s) each, labelled on screen as a test delay.
- W can cancel an attempt at any time.

### 6.6 Funded gate results (2026-10-30)

- [V] After W's direct create/grant, `OriginalAccount(H160(W)) = W` and reverse lookup returns W's public key. The installation trigger (funding versus first signed call) was not isolated.
- [V] Direct native `createWorkspace` and `appendBatch` finalized with owner/author `H160(W)` (SMART-CONTRACT 9.2, blocks 248378/248387).
- [V] The 2-of-3 → 24-block delay → finish → inherited `rotateEpoch` path succeeded. Both the outer dispatch and inner `RecoveredAccountControlled` result were Ok; epoch became 1, owner stayed W, and an inherited append continued at index 2.
- [V] One approval produced `NotApproved`; an early finish produced `NotYetInheritable`; control before inheritance produced `NoInheritor`; W canceled an attempt; vendor simulation and a mined reverted transaction both produced `NotWriter`.
- [V] No Recovery hold was observed in this run. W paid direct create/grant storage; N paid the inherited rotation/append fees while W's balance stayed unchanged. [U] Nonzero inherited storage allocation was not exercised, so its payer is not established.
- [V] A three-friend group, threshold 2, inheritance/cancel delays of 24 blocks were accepted. [U] Other runtime limits and minimum production-safe delays were not tested.

### 6.7 Running the spike

These scripts are **testnet-only**: native Recovery and Revive pallets cannot be rehearsed on Hardhat. Run `pnpm succession:keys` once to append only missing N/backup mnemonics to the gitignored root `.env`; it prints SS58 addresses only. W must already be configured. Then run `pnpm succession:preflight` (read-only), `pnpm spike:succession` (negative paths and authority gate), and `pnpm demo:succession` (narrative plus D12 key reconstruction). The last two refuse to sign unless their own preflight passes. Both accept `--delay-blocks N` and label it **TEST DELAY: N blocks (~N×6 s)**. The default is 24 blocks for the spike and 10 for the demo. The spike's one-approval finish, second approval and early finish each wait for finality (about 3 blocks each), so 10 blocks would expire before the early-finish check. The spike stops rather than pretend an early failure was observed. Every native `Revive.call` is capped at the funded budget: weight 10^12/10^6 and 16 tPOT of storage deposit.

[V] On 2026-10-27 the live preflight derives all five configured accounts, quotes all 20 planned extrinsic envelopes with `TransactionPaymentApi_query_info`, reaches `ReviveApi.call`, and fails on W's zero balance and the missing deployment. Without the registry, the destination `...0001` is explicitly a fee-only precompile encoding/probe, **not** a registry create dry-run. Once deployment exists, the native W create is dry-run with required weight and maximum storage-deposit bounds; every real native EVM call is estimated again against its actual preceding state. Fee quotations are not paid fees or evidence of call validity; the vendor `eth_transact` quotation uses fabricated signature components, not the vendor key.

[V] The raw live v16 metadata hash changes despite spec 3002: comparison against the original finalized block found the sole difference in `Revive.EthBlockBuilderIR`'s storage fallback. Preflight verifies the bundled pinned snapshot against the original blake2_256 hash, prints the live raw hash, and compares every metadata field except that one named state-dependent fallback. Calls, type IDs, constants, other defaults and runtime versions remain pinned. It never mixes v14 and v16. [V] `query_info` must receive `tx.toU8a()`; passing the hex string through the decorated runtime API produced a WASM decode trap.

[V] The funded spike confirmed the distinction between early finish (`NotYetInheritable`) and control before inheritance (`NoInheritor`), initiation as approval one, and W's immediate cancellation. It also checked the inner `RecoveredAccountControlled.call_result`. [I] Retained upstream source (not proven to be the deployed revision) says any signed payer may finish, time counts from `init_block`, and an initiating backup can cancel only after `last_approval_block + cancel_delay`. Only N was exercised as finish payer; backup cancellation remains untested.

Public run evidence goes to `out/succession/<timestamp>/evidence.json`: origin, EVM caller, inner/outer dispatch, finalized block/hash, extrinsic/tx hash, explorer block link, fee event and balance/hold deltas. The reusable workspace, ciphertext and owner key are stored separately in **private**, gitignored `out/succession/workspace.json` (0600 where supported; restrict Windows ACLs). Never publish that file. A subsequent demo verifies/reuses this workspace rather than paying a second create deposit, explicitly has W revoke a prior rehearsal inheritor, and forwards only recipient shortfalls. Reuse budgets W at 4 tPOT for the new epoch's vendor-writer slot + 0.5 tPOT ED/fee allowance + those shortfalls; additional rehearsals may require top-ups. D12 splits the original key 2-of-3 before succession, discards the in-memory owner key, reconstructs from two backup shares afterwards, verifies/decrypts complete history, and encrypts the continuation with that recovered key. This headless rehearsal holds shares on this device; it does not claim independent backup-wallet custody. Keys/shares are never printed or included in public evidence, only fingerprints.

### 6.8 Native calls are not indexed by the Ethereum RPC

[V] On 2026-10-30, W created a workspace, granted the vendor and appended through native `Revive.call`. The append finalized in [block 248295](https://scanner-testnet-v3.portaldot.dev/#/blocks/248295), extrinsic `0x1a62aea703389efb9248dd2a41c2c329df6c58fc88a8d70fe547527dc76cb21f`. Its native `revive.ContractEmitted` event decodes to `Appended(index=1, author=H160(W))`. `eth_getLogs` for that exact contract/block returned `[]`, and `eth_getTransactionReceipt` for the native extrinsic hash returned `null`. The vendor's EVM append in block 248292 is indexed normally.

The Succession scripts now use the optional `@packout/sdk/native` reader for both native and EVM admissions; the former script-local decoder is removed. A private checkpoint retains native block references alongside the private key/ciphertext. Reuse re-fetches block bodies and `system.events`, verifies canonical finality and decodes phase-bound registry admissions. Local report JSON is not proof. During a run, append the actual finalized native block reference before reading again. Export writes public `bundle.json` and `native-blocks.json`, never the key; keep the private checkpoint and any key file separate.

Checkpoints now persist the key before the first encrypted write and committed ciphertext after each finalized append. The first run predated these checkpoints and stopped after index 1; its in-memory random key was lost. Workspace `0xb74ce764f52242e4c97c2bcb179777324a02883826fb436c14e3680c098ee48f` is an abandoned spike, not a recoverable demo. It must not be presented as one.

**Boundary:** `@packout/sdk/native` provides the opt-in native-event reader described below; the ordinary SDK entry remains EVM-only. The independent CLI and browser proof view still need their native integration. Do not claim the default Ethereum-only readers verify this native Succession history.

[V] Native and Ethereum block hashes also differ at the same height: top-up block 248354 has native hash `0x1b4718708497d74ffd9b027e92357ab9f56cdab5e08c3592030560adbb1b1197` and EVM hash `0x2b68535f02a9af97f3050478896215760ace72646bfe8232b6856d507c2b340d`. Resolve a height with `chain_getBlockHash` before `api.at`; never pass an EVM receipt's block hash to the native API.

### 6.9 SDK and independent CLI native-reader contract

The bundle stays `packout.bundle/1`; no additional bundle fields or Solidity changes. Native event discovery uses a public sidecar JSON array of native block hashes (`0x` + 64 hex digits), at most 4096 entries. Normalize casing and deduplicate references. These are untrusted lookup hints, not receipts; missing hints never count as verified history. No full-chain scan is promised.

SDK interface: `createNativeRegistryReader({ client, registry, fromBlock?, nativeApi, blockHashes }): Promise<RegistryReader>` from `@packout/sdk/native`. `nativeApi` is an initialized `@polkadot/api` `ApiPromise`; the caller owns connect/disconnect. The reader retains the supplied `blockHashes` array so a writer may append a finalized native block reference before its next read. The ordinary `@packout/sdk` entry remains EVM-only; native decoding stays in the optional entry point.

Network binding: EVM RPC must actually report chain ID **420420777**, and native `genesisHash` must be **`0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd`**, observed with `chain_getBlockHash(0)` on 2026-10-30. Native support rejects other networks; do not trust only the viem client's configured chain ID.

For every new hinted block, fetch its native block body/header and `system.events`. Require its height to be at or below the native finalized head, at or below the current EVM reader height, and its hash to equal `chain_getBlockHash(height)`. Never pass an EVM block hash to the native node. Cache only verified finalized blocks for that reader's lifetime. Unknown, noncanonical, unfinalized or future references fail explicitly.

Wire event: `revive.ContractEmitted.data = [contractH160, evmDataHex, topicsHexArray]`; phase must be `ApplyExtrinsic(i)`, with an existing block extrinsic at index i. Decode only the configured registry and topic `0xf8c557326949317cd7769ba05fb911f13c76dbcb6883b4a38bee487cb1c31b47` using `event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head)`. Matching malformed logs fail, rather than disappearing. Ignore other contracts/event topics/phases. A native admission's `txHash` is its native extrinsic hash, not an Ethereum transaction hash.

Merge EVM and native admissions by `(wsId, index)`. Identical admissions from the same block (same author, epoch, digest and head, ignoring hex casing) are one event; prefer the EVM identifier if available. Different content or block heights at the same index is ambiguous and fails, never first-wins. Filter by workspace/index and SDK `fromBlock`; range reads return sorted indices. Preserve all existing registry state and permission reads. Native event contents and hashes always come from the node, never the sidecar or local evidence JSON.

CLI flags: `--native-blocks <file>` opts in; `--native-rpc <URL>` accepts HTTP(S) or WS(S), defaults to `wss://test-node-v3.portaldot.dev`, and is invalid without `--native-blocks`. EVM `--rpc` remains HTTP(S)-only. Bad flags, URLs or unreadable/malformed sidecars exit 2 without printing file contents. Valid input with failed chain proof exits 1. No key still reports decryption SKIPPED, not passed; a supplied valid key must pass all six checks. Trust output names both RPC endpoints and the RPC-trusted (not light-client) boundary. Native blocks must not exceed the CLI's one observed EVM snapshot height. Native requests and initialization have a 15-second deadline with actual transport cancellation; disconnect the owned client even on failure. CLI runtime code must not import SDK or Succession implementation; implement from this wire contract.

[V] Transport ruling, 2026-10-30: real CLI HTTP reads received nginx HTTP 503 responses on valid historical `chain_getHeader`, `chain_getBlock` and `state_getStorage(system.events, blockHash)` requests. Isolated raw, standard-provider and bounded-provider reads succeeded; the gateway's underlying failure is UNVERIFIED. WSS is already used by the funded Succession scripts and read-only preflight, so it is the CLI native default. HTTP remains explicitly selectable; there is no automatic retry or silent fallback between endpoints.

Owned CLI connections are read-only, non-subscription RPC transports: open the connection before initializing `ApiPromise`, cancel the actual pending I/O on deadline, and await closure before returning failure. `WsProvider.disconnect()` alone is not a cancellation guarantee: the installed provider starts a graceful close handshake and polls request deadlines every 5 seconds. A Node WebSocket transport must use an instance-local force-termination capability for an unresponsive established peer; do not alter the global WebSocket constructor. SDK callers still own their supplied API's connection and timeout policy.

Acceptance: SDK and CLI independently verify the existing six-operation Succession workspace with its real native blocks; omitted final hints, wrong key, altered envelopes, wrong network, future/noncanonical block references and conflicting admissions fail closed. Existing EVM-only flows and browser builds remain unchanged. Succession scripts migrate to the SDK reader and export public `bundle.json` + `native-blocks.json`, with keys kept separately. UI and independent backup-device custody remain outside this change.

