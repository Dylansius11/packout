# PACKOUT: agent operating rules

PACKOUT lets a team leave a SaaS vendor without losing its workspace: restore the full history in an independent client and keep writing under the same owner-controlled authority on Portaldot. Built for Portaldot Hacker House 2026, Modular Cloud & Middleware track.

These rules bind every agent and human working in this repo. When a rule conflicts with a habit, the rule wins.

## 1. Read order (every new session)

1. This file.
2. `PRD.md`: problem, users, features, scope, non-goals.
3. `BUILD-PLAN.md`: phases, checkboxes, acceptance criteria. Work the first unchecked box.
4. `OPEN-DECISIONS.md`: unresolved decisions and blockers. Never silently decide a row marked `owner: founder`.
5. `docs/technical/ARCHITECTURE.md`, `docs/technical/SMART-CONTRACT.md`, `docs/technical/INTEGRATIONS.md` when the task touches them.
6. `LESSONS.md`: read the headlines before starting; they record mistakes not to repeat.

`DESIGN.md` does not exist yet. Until it does, UI work follows the UX bar in section 8 and is limited to functional, clean screens. Do not invent a brand system.

## 2. Hard deadlines (UTC)

| Milestone | Time | What must exist |
| --- | --- | --- |
| Check-in | 2026-10-24 12:00 | Public repo, complete README, architecture diagram, real testnet contract address + tx hash, demo video (3 min max) or live link showing one core flow |
| Feedback | 2026-10-26 16:00 | Read and log in OPEN-DECISIONS |
| Core feature-complete | 2026-11-05 04:00 | Rules forbid committing final core modules in the last 24h |
| Final submission and code freeze | 2026-11-06 04:00 | README, deploy docs, runnable demo, video, pitch deck, contract + tx |
| Live demo | 2026-11-08 to 11-09 | Rehearsed demo script |

The organizer explicitly requires a real Portaldot testnet contract address. Simulation alone does not qualify.

## 3. Commits (non-negotiable)

- One behavior per commit. Size 50 to 350 changed lines, excluding lockfiles and generated artifacts. A bigger change is split (contract, then logic with tests, then UI, then fix-ups). A docs-only or config-only commit may be smaller than 50 lines when it is a complete unit.
- Subject: `feat|fix|refactor|test|docs|perf|chore|ci(scope): outcome in plain words`. Body: why, and what proves it (test names, command output, tx hash). No file lists. No agent or AI attribution.
- Docs ride in the same commit as the change they describe. If code changes behavior, the affected PRD, BUILD-PLAN checkbox, technical doc, OPEN-DECISIONS row or LESSONS entry is updated in that same commit.
- A BUILD-PLAN checkbox is ticked in the commit that satisfies its acceptance criteria, never earlier.
- Every commit passes `pnpm check` (lint, typecheck, unit tests for affected packages). Contract changes also pass `pnpm --filter @packout/contracts test`.
- Stage only the unit's paths. Never commit `.env*`, private keys, mnemonics, `.claude/skills/`, build output or scratch files.
- Push to `origin main` after each commit (`Dylansius11/packout`, public). `git pull --rebase` before pushing. Never force-push. No merge commits.
- The repo must show genuine continuous development: the organizer audits commit timelines.

## 4. Docs discipline

- `LESSONS.md`: when something surprises you (a failed assumption, a tool quirk, a Portaldot behavior, a wasted hour), add an entry: `### YYYY-MM-DD: headline`, then bullet points (what happened, root cause, rule going forward). Newest on top. Commit it with the fix.
- `OPEN-DECISIONS.md`: any requirement you cannot satisfy, any blocker, any decision needing the founder goes in the table with a status. Close rows with the resolution and the commit that resolved it.
- `BUILD-PLAN.md`: keep it the single source of progress. Add a box when you discover required work; never delete an unchecked box without a note.
- Mark unverified facts as UNVERIFIED. Never write a tx hash, address, metric or result you did not observe.

## 5. Team model and delegation

You (the session lead, Claude Opus 5.5) are the lead engineer and orchestrator: plan, delegate, review every diff, integrate, commit, keep docs true.

| Work | Agent | Model |
| --- | --- | --- |
| Contracts, SDK, crypto, server, CI, test infrastructure | `task` / `executor` | GPT 6.1 Sol |
| UI implementation, layout, motion | `secondary-executor` | Claude Sonnet 5.5 |
| Mechanical edits, data collection | `sonic` | light model |
| Review against acceptance criteria | `reviewer`, then yourself | |

- At most 3 workers at once. At most 1 Sonnet worker at a time (shared rate limit).
- Give each worker the exact files, the interface contract, the acceptance criteria from BUILD-PLAN and the relevant doc sections. Workers do not commit; you review and commit.
- Workers skip full-suite runs mid-flight; you run the checks once after integrating.

## 6. Skills (project allowlist in `.omp/config.yml`)

| When | Skill |
| --- | --- |
| Planning a phase | `writing-plans`, `executing-plans`, `subagent-driven-development` |
| Any logic or bugfix | `test-driven-development`, `systematic-debugging` |
| Before claiming done | `verification-before-completion` |
| Module boundaries | `codebase-design`, `improve-codebase-architecture` |
| Review | `requesting-code-review`, `code-review` |
| UI and motion | `impeccable`, `emil-design-eng`, `design-taste-frontend`, `motion` |
| Scope creep check | `ponytail` |
| Library docs | `find-docs` |

Project skills live in `.claude/skills/` (gitignored). Restore on a fresh clone with `npx skills@latest experimental_install` (reads `skills-lock.json`).

## 7. Engineering standards

- TypeScript strict everywhere. No `any` without a comment explaining why. Zod at every trust boundary (HTTP input, bundle import, env).
- Money and chain values are `bigint`. Never floats. Native Portaldot units have 14 decimals; EVM units have 18 (`NativeToEthRatio = 10000`). Convert only through the shared helper.
- The head-chain formula in `docs/technical/SMART-CONTRACT.md` is the protocol. Solidity and the SDK must produce byte-identical heads; a shared test vector file enforces it.
- `apps/client-b` must never import from `apps/vendor-a` or `apps/vendor-api`, and must never call the vendor API. It depends only on `@packout/sdk`, the chain and the bundle file. A test enforces this.
- Small modules with one job. Prefer deleting code to adding abstraction. No feature flags, no speculative options.
- Errors are explicit and user-legible. Never swallow an error to make a demo pass.

## 8. UX bar

UX is a judged product quality, not decoration.

- Every chain action shows its real state: preparing, waiting for wallet, submitted, finalized, failed with a plain reason. Show tx hash and explorer link once real.
- Every write shows where the data lives: on this device, on the vendor, anchored on Portaldot.
- Restore shows each verification step with pass or fail and a human sentence. A failed check blocks continuing and says exactly what is wrong.
- No fake progress, no placeholder data presented as real, no spinner without a timeout message.
- Keyboard accessible, readable contrast, works at 1280px and 390px.
- Motion only where it explains a state change. Respect `prefers-reduced-motion`.

## 9. Testing

| Layer | Tool | Scope |
| --- | --- | --- |
| Contract | Hardhat 3 tests (Solidity tests for invariants, TypeScript + viem for flows) | every function, every revert, head formula vectors |
| SDK and server | Vitest | encoding, crypto, head chain, bundle, verifier, reducer, batcher |
| End to end | Playwright | create, write, export, stop vendor, restore in B, exit, new write, vendor write rejected |
| Testnet | `pnpm smoke:testnet` script | real deploy and calls on Portaldot; outputs recorded in SMART-CONTRACT.md |

Tests assert behavior a user would notice: boundaries, rejections, invariants, state transitions. No tests of wiring, mock echoes or incidental defaults. A bug fix lands with a test that fails before and passes after.

## 10. Portaldot quick facts (verified 2026-10-23)

- EVM RPC `https://test-evm-rpc-v3.portaldot.dev`, chain ID `420420777`. Native WSS `wss://test-node-v3.portaldot.dev`. Explorer `https://scanner-testnet-v3.portaldot.dev`.
- Runtime `portaldot-v3` spec 3002. `AllowEVMBytecode = true`, `AutoMap = true` (do not call legacy `map_account`).
- Storage deposits dominate cost: 0.06 tPOT per byte, 0.15 tPOT per storage item. Keep state minimal; put history in events.
- Test tokens go to a native SS58 address (starts with 5) through the official Discord process. Fund the EVM deployer's mapped account found via `reviveApi.accountId`. See INTEGRATIONS.md.
- Unproven, never depend on: iBridge routes, WASM/EVM cross-calls, DaaS APIs, the `@portaldot/sdk` npm package (registry 404).

## 11. Safety

- Never request, print, log or commit secrets. Keys live in `.env` (gitignored) and GitHub Actions secrets.
- Never sign or send transactions on the founder's behalf without the founder's configured key in `.env`.
- Ask the founder before destructive actions, paid services, new accounts or public posts.
