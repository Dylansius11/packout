# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Hackathon judges and auditors** (primary on the landing page): evaluate in minutes whether Packout is real, needs a blockchain, and works on Portaldot. They distrust mock data and receipt contracts.
- **App builders** (primary buyer): want to offer "exit-proof" shared workspaces without building verifiable export, restore and authority transfer themselves.
- **Workspace owner** (team lead): keeps the team's workspace alive whatever the vendor does; signs the takeover transaction.
- **Member** (writer): writes issues and comments daily with no wallet and no chain vocabulary.

## Product Purpose

Packout lets a team leave a SaaS vendor without losing its workspace: restore the full history in an independent client and keep writing under the same owner-controlled authority on Portaldot. Success: the vendor is stopped, the workspace continues in another app as the next operation of the same history, and the old vendor's comeback write is refused on-chain.

## Positioning

An export file is dead: unverifiable, authority stays behind, continuation is impossible. Packout's mechanism is a small Portaldot registry acting as a neutral referee for who owns the workspace, who may write now, and the exact ordered history (a hash chain), while data stays encrypted off-chain. Independent clients share one write-admission rule, so a takeover is one owner transaction and the old vendor is locked out. Honest boundary: for a static personal backup, ordinary encrypted storage is simpler.

## Operating Context

- Three surfaces: the landing page (`apps/site`), Vendor A (`apps/vendor-a`, the hosted issue journal being left), and Packout Restore (`apps/client-b`, called Client B in docs: import, verify, take over, continue, public proof page).
- Packout Restore never imports Vendor A code and never calls the vendor API; a test enforces it.
- Chain actions run against Portaldot testnet (EVM chain id 420420777, explorer `scanner-testnet-v3.portaldot.dev`) or a local Hardhat chain for rehearsal.
- An independent verifier CLI (`pnpm verify`) checks bundles from the terminal; it is not interactive.

## Capabilities and Constraints

- Real today: contract deployed on Portaldot testnet, SDK, bundle format v1, six-check verifier, Vendor A app, Packout Restore, public proof page, verifier CLI, headless testnet demos, native Succession (authority recovery via Portaldot Recovery pallet) proven by headless scripts.
- Not yet: hosted deployment, browser native-history/Succession panel, independent backup-device custody, npm publication of the CLI.
- Every chain action must show its real state (preparing, waiting for wallet, submitted, finalized, failed with reason); every write says where data lives (device, vendor, anchored on Portaldot).
- Accessibility: keyboard operable, readable contrast, 1280px and 390px, `prefers-reduced-motion` respected.
- E2E tests pin exact user-visible strings (see `e2e/`); copy changes to those strings must update the tests.

## Brand Commitments

- Name: **Packout** (wordmark set in a neo-grotesk with a ™). Restore client is named **Packout Restore** in UI.
- Mark: a pixel figure carrying a pack, trailing loose pixels (packing out); files in `assets/` (`packout-logo-vibes.png`, `icon-bg.png`, `icon-no-bg.png`). The founder asked that the product follow the logo's vibe and improve on it.
- Copy language: English.
- Vendor A is a deliberately ordinary, separate SaaS identity so the exit story reads; it is not Packout-branded.

## Evidence on Hand

- Registry `0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0` on Portaldot testnet; deployment, demo and Succession tx hashes in `docs/technical/SMART-CONTRACT.md` sections 8–9.
- Testnet runs: `demo:full` (2026-10-29) ending in a mined `NotWriter` vendor refusal; Succession authority gate and key recovery (2026-10-30); SDK + CLI native-history verification (section 9.4).
- No customers, testimonials, pricing, usage metrics or benchmarks exist. Never invent them.

## Product Principles

1. Prove, don't claim: every assertion links to a transaction, a check result or code.
2. The user keeps the keys: plaintext and keys never leave the device or reach the vendor or chain.
3. Show real state, including failure, in plain words.
4. Small, honest boundaries beat big promises.
