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

Explorer URL templates and RPC limits (`eth_getLogs` range, supported tx types): filled in from the RPC probe and the first deploy (BUILD-PLAN 1.4).

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
| `VENDOR_WRITER_PRIVATE_KEY` | vendor-api batcher, `demo:checkin` | Vendor A's writer key |
| `PORTALDOT_EVM_RPC` | everything that talks to the chain | defaults to the testnet EVM RPC |

## 5. GitHub Actions secrets

Set on `Dylansius11/packout` only for the manual testnet smoke workflow (BUILD-PLAN 6.2): `DEPLOYER_PRIVATE_KEY`, `VENDOR_WRITER_PRIVATE_KEY`. Push CI uses a local chain and needs no secrets.
