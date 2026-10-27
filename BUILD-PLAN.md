# PACKOUT: Build Plan

Tick a box only in the commit that meets its acceptance criteria (AC). Work top to bottom. Add boxes for newly discovered required work; never delete an unchecked box without a note. Dates are UTC targets.

Legend: P0 required for final demo, P1 strongly wanted, P2 stretch. Feature ids refer to PRD section 5.

## Phase 0: Bootstrap (2026-10-23)

- [x] Repo initialized, project skills installed (`skills-lock.json`), `.omp/config.yml` skill allowlist
- [x] Draft agent rules `CLAUDE.md`, `PRD.md`, this plan (written by the ideation session; lead reviews and owns them)
- [x] `OPEN-DECISIONS.md`, `LESSONS.md`
- [x] `docs/technical/ARCHITECTURE.md`, `SMART-CONTRACT.md`, `INTEGRATIONS.md`
- [x] Public GitHub repo `Dylansius11/packout` with `main` pushed

AC: a fresh agent can read the docs and start Phase 1 without asking what the product is.

## Phase 1: Check-in sprint (deadline 2026-10-24 12:00 UTC)

Goal: one real core flow on Portaldot testnet, honestly documented. Breadth comes later.

- [x] **1.1 Monorepo scaffold.** pnpm 12 workspaces, Node 24 LTS pinned (`.nvmrc`, `engines`, `packageManager`), Biome 2.6, root Vitest 5 config, TypeScript 7.0 with fallback to 5.9.3, `pnpm check` (lint + typecheck + unit tests).
  - AC: `pnpm install && pnpm check` passes on a clean clone. TS 7 compatibility result (Hardhat, Vite, Vitest) recorded in LESSONS and the resulting choice closed in OPEN-DECISIONS D2.
- [x] **1.2 PackoutRegistry contract (F1).** Implements the spec in `docs/technical/SMART-CONTRACT.md` exactly.
  - AC: Hardhat 3 tests cover create (and duplicate revert), grant, revoke, rotateEpoch, append batch, stale count revert, stale head revert, unauthorized revert, revoked-writer revert, previous-epoch writer revert, batch size limit, events. Shared head vectors file passes.
- [x] **1.3 SDK core (F2 subset).** Canonical op encoding, envelope encryption, digest, head chain.
  - AC: Vitest passes; SDK reproduces every head vector the contract tests use (`packages/sdk/test/vectors/head-chain.json` shared with contracts).
- [ ] **1.4 Testnet deploy spike.** Blocked by OPEN-DECISIONS B1 (funded keys). Steps in INTEGRATIONS.md.
  - AC: contract deployed to Portaldot testnet; real txs for createWorkspace, grantWriter and one append batch; `eth_getLogs` returns the `Appended` event; compiler version and EVM target pinned; address, tx hashes, explorer links and measured deposit/gas written to SMART-CONTRACT.md "Deployments". Every surprise logged in LESSONS.
- [ ] **1.5 Check-in demo.** `pnpm demo:checkin` script against testnet: create workspace, encrypt three ops, append via a writer key, export a bundle, verify it against the chain, print a readable report.
  - AC: script runs end to end on testnet; a 3-minute-max screen recording shows it plus the explorer; nothing simulated is presented as real.
- [ ] **1.6 README v1.** One-liner, problem, how it works, mermaid architecture diagram, deployment info (address, tx hashes, explorer), how to run, honest status (works now vs planned), license (MIT).
  - AC: README answers every check-in field; founder submits the check-in on DoraHacks (founder action, track in OPEN-DECISIONS).

## Phase 2: Protocol complete (target 2026-10-27)

- [x] **2.1 Bundle format v1 (F2).** Export/import per ARCHITECTURE section 5, Zod-validated.
  - AC: round-trip test; malformed bundle rejected with a specific error.
- [x] **2.2 Verifier (F2).** Ordered checks: format, digests, head recomputation, match against on-chain `Appended` event at index N-1, completeness against current on-chain count, decryption.
  - AC: tamper tests (omit, alter byte, reorder, substitute workspace, wrong key, stale bundle) each fail at the right step with a human message.
- [x] **2.3 Reducer (F2).** Ops to workspace state for schema `packout.journal/1`.
  - AC: deterministic state from any valid op sequence; unknown op type is a verifier error, not a silent skip.
- [x] **2.4 Chain client (F2).** viem-based reads (workspace, writers, events) and writes (create, grant, revoke, rotate, append) with typed errors for contract reverts.
  - AC: integration tests against a local Hardhat node.

## Phase 3: Vendor A API (target 2026-10-28)

- [x] **3.1 Envelope store + HTTP API (F3).** Hono on Node 24; `node:sqlite` storage (fallback recorded if unstable).
  - AC: Vitest integration tests for submit, list-from-index, status; invalid input rejected by Zod.
- [x] **3.2 Batcher (F3).** Appends pending envelopes on-chain with the vendor writer key; on stale head, refetch and retry with bounded attempts; on `NotWriter`, enter a terminal "revoked" state surfaced to clients.
  - AC: tests for happy path, concurrent stale-head conflict, revocation.

## Phase 4: Vendor A web app (target 2026-10-31)

- [x] **4.1 App shell.** Vite 8, React 19.3, TanStack Router, Tailwind 4.3, shadcn; wallet via viem/wagmi for the owner only.
- [x] **4.2 Owner onboarding (F4).** Connect wallet, create workspace, generate key, grant vendor writer, all with real transaction states.
- [x] **4.3 Journal (F4).** Create issue, change status, comment; member invite link with key in URL fragment.
- [x] **4.4 Sync indicator + local mirror + export (F4).** IndexedDB (Dexie) mirror; per-op state: device, vendor, anchored (index + explorer link); "Export bundle".
  - AC for phase: Playwright creates a workspace, writes three ops as a member, exports a bundle that passes the verifier.

## Phase 5: Client B restore app (target 2026-11-02)

- [x] **5.1 Import + verification UI (F5).** Step-by-step checks with plain-language results; incomplete or failed bundle blocks continuing.
- [x] **5.2 Workspace view (F5).** Read-only render of reconstructed state before takeover.
- [x] **5.3 Takeover (F5).** Owner wallet signs `rotateEpoch` revoking Vendor A and authorizing Client B.
- [x] **5.4 Continue writing (F5).** New ops append directly from Client B and appear in state.
- [x] **5.5 Independence guard.** Test fails if `apps/client-b` imports vendor packages or references the vendor API URL.
  - AC for phase: Playwright runs the full PRD section 4 demo with the vendor process stopped, including the final rejected vendor write. Met by `e2e/demo.spec.ts` (local chain); the testnet run is 7.1.

## Phase 6: CI and quality (target 2026-11-03)

- [x] **6.1 GitHub Actions.** On push: install, Biome, typecheck, Vitest, Hardhat tests, Playwright against a local chain; cache pnpm.
- [ ] **6.2 Testnet smoke job.** Manual-dispatch workflow using repo secrets, mirroring `pnpm smoke:testnet`.
  - AC: CI green on `main`; README badge.
  - 2026-10-27: repository secrets `DEPLOYER_PRIVATE_KEY` and `VENDOR_WRITER_PRIVATE_KEY` are set with the founder's approval. The first dispatch waits for the committed testnet deployment from 1.4; tick after a green run.

## Phase 7: Real testnet demo (target 2026-11-03)

- [ ] **7.1 Full demo on Portaldot testnet** with hosted Vendor A, hosted Client B and hosted vendor API (hosting per OPEN-DECISIONS D5). Record tx hashes for every step in SMART-CONTRACT.md.
- [x] **7.2 Proof view (F6, P1).** Read-only workspace proof page: owner, writers, count, head, recent appends with explorer links.
- [ ] **7.3 Backup recording** of the full real run.
- [ ] **7.4 Headless full demo.** `pnpm demo:full` runs PRD section 4 without a browser: restore and verify, `rotateEpoch(wsId, [])`, owner write at the next index, vendor write refused by simulation and then mined as a reverted tx (OPEN-DECISIONS D10), old export refused as stale. Local rehearsal passes (`pnpm demo:full:local`); tick after the testnet run is recorded in SMART-CONTRACT.md.

## Phase 8: Design and UX pass (target 2026-11-04)

- [ ] **8.1 DESIGN.md** once the founder picks references (OPEN-DECISIONS D8). Do not start before.
- [ ] **8.2 Apply design** to Vendor A and Client B using `impeccable`, `emil-design-eng`, `design-taste-frontend`, `motion`. Client B must look like a different product.
- [x] **8.3 UX audit** against CLAUDE.md section 8 at 1280px and 390px, keyboard-only, reduced motion.
  - 2026-10-27: done on the current functional screens, with no visual design pass (D8 is deferred). The full section 4 flow and the proof view were walked in headless Chromium, including runs with reduced motion and with slow RPC.
  - Fixed: missing `<h1>`s (axe), focus dropped to `<body>` after 25 actions, a refused Client B write whose reason vanished, and colliding rail links at 390px. axe now reports 0 violations, and e2e asserts that focus lands on the verification result.
  - Left as is: the wallet-connect wait has no timeout message (it has no spinner); the progress spinner keeps a slow 3 s turn under reduced motion. Not exercised: a real wallet, testnet, a screen reader, or browsers other than Chromium.

## Phase 9: Submission (core complete by 2026-11-05 04:00, freeze 2026-11-06 04:00)

- [ ] **9.1 README final**: problem, why Portaldot, architecture, deployment instructions, addresses and tx hashes, what was built in-window, AI-tool disclosure, license.
- [ ] **9.2 Demo video** (3 min max): pain, one-liner, continuous real flow ending in rejected vendor write, why Portaldot, business, next 90 days.
- [ ] **9.3 Pitch deck** (PDF or link): problem, why Portaldot is essential, proof of function, why continued support.
- [ ] **9.4 Freeze checklist**: fresh-clone run, all links work, no secrets, no final core commits in the last 24 hours.
- [ ] **9.5 Live demo script** rehearsed for 2026-11-08.

## Phase 10: Succession (gated, PRD F9; target 2026-11-04)

This phase never delays Phase 1 (1.4, 1.5) or Phase 7. Only 10.0 runs before funding. 10.1 starts only after B1 funding lands and 1.4 is done. If 10.1's gate fails, Phases 1–9 are unaffected: cut Act 3 from PRD section 4, the video and the pitch, close 10.2 and 10.3 with a note, and record why in OPEN-DECISIONS and LESSONS. No core Succession commit lands after 2026-11-05 04:00.

- [x] **10.0 Read-only prep (no funds).**
  - Pin the live metadata.
  - Decode the exact Recovery, `Revive.call` and Multisig call encodings.
  - Find how a native AccountId32 maps to its EVM-visible address, and dry-run the native caller where the RPC allows.
  - Check whether W can call `createWorkspace` through native `Revive.call` with no contract change.
  - Compute the extra funding from metadata constants.
  - AC: INTEGRATIONS.md section 6 "Native succession" documents all of this with [V]/[I]/[U] on every claim, and B1 carries the extra amount.
- [ ] **10.1 Funded spike and gate (2–4 h, after B1 + 1.4).**
  - AC, with real testnet tx hashes:
    1. W, via native `Revive.call`, creates or appends, and the contract sees `msg.sender == H160(W) == owner`.
    2. 2-of-3 backups approve, the delay elapses, and the inheritor's `control_inherited_account(W, Revive.call(rotateEpoch))` succeeds with the same `msg.sender`.
    3. Failure paths: 1-of-3 approval cannot finish (`NotApproved`), finishing before the delay fails (`NotYetInheritable`), dispatching as W before an inheritor is installed fails (`NoInheritor`), W cancels an attempt, and the old vendor's append after rotation reverts `NotWriter`.
  - Each step records the native origin, EVM caller, dispatch result and block in SMART-CONTRACT.md "Deployments" and in LESSONS.
  - If AC 1 or 2 fails, Succession is killed (see the phase note).
  - 2026-10-27: `pnpm spike:succession` is written and runs these steps in order. It refuses to sign until `pnpm succession:preflight` passes (INTEGRATIONS 6.7). Waiting for B1 and 1.4.
- [ ] **10.2 `pnpm demo:succession`.** A headless, testnet-only script (native pallets cannot be rehearsed on Hardhat; it says so) that prints every step with its explorer link, plus the encryption-key path chosen in D12.
  - AC: one recorded testnet run; every tx hash appears in SMART-CONTRACT.md.
  - 2026-10-27: the script is written. It reuses the spike's workspace, so there is no second create deposit, and uses the SDK 2-of-3 key shares for D12. Waiting for the 10.1 gate.
- [ ] **10.3 Proof, README and video integration.**
  - The proof view gains an "Authority" line: owner `H160(W)`, friend-group threshold, delay, current inheritor and last succession tx.
  - Client B gets a read-only Succession panel.
  - The README gets Act 3, the "why Portaldot" line and its honest boundary (a Safe plus recovery module can do something similar on other EVM chains).
  - The video gets about 30 s for Act 3.
  - AC: screenshots at 1280 and 390 px; README claims link to real tx hashes.

## Stretch (only after Phase 7)

- [ ] F7 independent verifier CLI written from the format spec.
- [ ] F8 second replica for encrypted envelopes.
