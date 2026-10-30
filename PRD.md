# PACKOUT: Product Requirements

**One-liner:** Move your workspace to another app, with its history intact and your control unchanged.

**Track:** Portaldot Hacker House 2026, Modular Cloud & Middleware. **Status:** scope locked 2026-10-23 (PACKOUT pure: owner + writers; no group purchasing, no per-section permissions).

## 1. Problem

Teams put months of decisions, issues and comments into hosted tools. The vendor holds three things at once: the data, the authority to write, and the official version of history.

When the vendor shuts down, raises prices, changes terms or gets acquired, the team can usually export a file. That file is dead:

- **History is incomplete or unverifiable.** Nobody can prove the export contains every committed change in order.
- **Authority stays behind.** Permissions, roles and the right to keep writing live in the vendor's database.
- **Continuation is impossible.** A new app can display the old data, but cannot continue the same workspace with the same members and the same canonical history.

Web3 builders are especially exposed: hackathon tooling, grant trackers and community workspaces disappear constantly, and the teams using them rarely control anything but a CSV.

## 2. Insight

Ordinary backups solve *storage*. They do not solve *who is allowed to continue*. That needs a neutral referee that no single vendor controls:

- who owns the workspace,
- who may write right now,
- what the exact ordered history is,
- that a stale or unauthorized write is refused.

A small Portaldot contract is that referee. Data stays encrypted off-chain with the users; the chain holds only ownership, writer permissions and a hash chain of every operation. If the contract were replaced by the vendor's database, the vendor would again decide permissions and the official history. That is the blockchain-necessity test, and PACKOUT passes it only because multiple independent clients share one write-admission rule.

**Honest boundary:** for a static personal backup, ordinary encrypted storage is simpler. PACKOUT is for shared workspaces whose authority must outlive the vendor.

## 3. Users

| User | Job | Pain today |
| --- | --- | --- |
| Workspace owner (team lead) | Keep the team's workspace alive regardless of the vendor | Locked into one vendor's database for permissions and history |
| Member (writer) | Write issues and comments without thinking about chains | Must not need a wallet for daily work |
| App builder (our real buyer) | Offer "exit-proof" workspaces as a feature, cheaply | Building verifiable export, restore and authority transfer from scratch |
| Judge / auditor | Verify claims in seconds | Most demos are mock data and receipt contracts |

The commercial product is the **exit kit** (contract + SDK + open bundle format + restore client) that app builders integrate. The two journal apps are reference implementations proving it works.

## 4. The demo moment (never cut)

1. A team works in **Vendor A** (a normal-looking issue journal). Members write without wallets; each change is encrypted on the device and anchored on Portaldot by the vendor's writer key.
2. The owner exports a bundle (or already has the local mirror).
3. **Vendor A is shut down** for real: the API process is stopped.
4. **Client B**, a different app with no code path to Vendor A, imports the bundle, verifies every operation against Portaldot step by step, decrypts locally and shows the full workspace.
5. The owner signs one transaction: Vendor A's write access is revoked and Client B is authorized.
6. The owner writes a new issue in Client B. It is accepted on-chain as the next operation of the same workspace.
7. Vendor A comes back online and tries to write. **Portaldot rejects it.**

The vendor is gone, the workspace continues, and the old vendor has lost control. That sequence is the product.

**Act 3: Succession (gated on F9's spike; cut it if the gate fails).** The owner then loses their key as well. Two of three backup wallets approve a recovery; after a visible delay, the designated inheritor uses Portaldot's native Recovery pallet to act as the same workspace-authority account. That account rotates the epoch again under the **same** contract owner, the workspace continues, and the old vendor is still refused. Steps 1 to 7 stay the baseline and are never cut for Act 3.

## 5. Features

Priority: P0 = required for the final demo, P1 = strongly wanted, P2 = stretch.

### F1. Workspace registry contract (P0)
- Create a workspace with an owner and schema id.
- Owner grants and revokes writers; owner can rotate the writer epoch, revoking everyone at once and authorizing a new set in one transaction.
- Owner and current-epoch writers append batches of operation digests. Each append must quote the expected count and head; stale writes revert.
- Every append extends a hash chain and emits an event carrying index, author, epoch, digest and new head.
- Acceptance: every function and revert covered by tests; head-chain vectors match the SDK byte for byte; deployed on Portaldot testnet with real tx hashes.

### F2. SDK `@packout/sdk` (P0)
- Deterministic operation encoding, XChaCha20-Poly1305 encryption with a workspace key, envelope digest.
- Head-chain computation identical to the contract.
- Bundle export and import (versioned open format) and a verifier that reports each check.
- Reducer that turns decrypted operations into workspace state (issues, statuses, comments).
- Chain client: read workspace state and `Appended` events; build append, grant, revoke, rotate transactions.
- Acceptance: Vitest coverage of encoding, crypto, chain, bundle tampering (omitted, altered, reordered, substituted workspace op each fails), reducer.

### F3. Vendor A API `apps/vendor-api` (P0)
- Stores encrypted envelopes (it never sees plaintext or the workspace key).
- Batches pending envelopes and appends them on-chain with the vendor's writer key; handles stale-head conflicts by refetching and retrying.
- Serves envelopes and confirmation status to Vendor A clients.
- Acceptance: integration tests against a local chain; a revoked vendor key produces a visible "write access revoked" state, not a silent retry loop.

### F4. Vendor A web app `apps/vendor-a` (P0)
- Issue journal: create issue, edit status, comment. Member identity is a display name; no wallet needed for members.
- Owner onboarding: connect wallet, create workspace, generate workspace key, grant vendor writer.
- Invite members by link; the key travels in the URL fragment, never to the server.
- Sync indicator per change: on this device, sent to vendor, anchored on Portaldot (with index and explorer link).
- Local mirror in IndexedDB and one-click "Export bundle".
- Acceptance: Playwright creates a workspace, writes three operations and exports a bundle that verifies.

### F5. Client B restore app `apps/client-b` (P0)
- Visibly different product. Imports bundle + key, verifies against Portaldot with a step list (format, digests, chain head match, completeness vs current on-chain count, decryption), then renders the workspace.
- Owner "Take over": one `rotateEpoch` transaction revoking Vendor A and authorizing Client B.
- New writes from Client B append directly on-chain.
- Blocks continuing when the bundle is incomplete or any check fails, and explains why.
- Acceptance: Playwright runs the full demo moment with the vendor process stopped.

### F6. Proof surfaces (P1)
- Public read-only "workspace proof" view: owner, writers, count, head, recent appends with explorer links.
- README, architecture diagram, contract addresses and tx hashes kept current.

### F7. Independent verifier CLI (P2)
- `npx @packout/verify bundle.json` verifies a bundle against the chain, written from the format spec, to prove a third party can implement the format.

### F8. Second replica (P2)
- Mirror encrypted envelopes to a second owner-chosen location so restore does not depend on the owner's single device. Choice open in OPEN-DECISIONS.

### F9. Succession (P1, gated)
- The workspace owner is a dedicated native workspace-authority account W, never a personal funded wallet. The 2026-10-30 funded spike proved `msg.sender == H160(W)` for direct native `Revive.call` and inherited Recovery dispatch, with the same contract owner and no Solidity change (SMART-CONTRACT section 9.2). The opt-in SDK reader and independent CLI now verify mixed native/EVM history using public block hints (INTEGRATIONS 6.9); Ethereum RPC alone omits native logs. Browser/proof-panel integration remains open in BUILD-PLAN 10.3.
- W configures a Recovery friend group: three backup wallets, 2 approvals needed, one inheritor and an inheritance delay (a short, on-screen-labelled test delay in the demo).
- After 2-of-3 approval and the delay, the inheritor calls `Recovery.control_inherited_account(W, Revive.call(registry, rotateEpoch(wsId, [])))`. The owner identity does not change, so the contract needs no change and no ownership-transfer function.
- Recovery restores **authority**, not the workspace encryption key. The inheritor gets the key through an explicit key path (OPEN-DECISIONS D12); a demo that silently copies the old key does not count.
- Security story: one leaked backup is not enough (2-of-3); the real owner can cancel an attempt during the delay; the inheritor cannot rewrite the recovery configuration (`control_inherited_account` cannot dispatch Recovery calls).
- Gate (BUILD-PLAN 10.1): real testnet tx hashes prove `msg.sender == H160(W) == owner` both for W directly and through `control_inherited_account`, plus the failure paths. If the gate fails, F9 is removed from the demo and pitch. It is never faked, and a contract-level recovery module is never presented as native.
- Acceptance: `pnpm demo:succession` on testnet (native pallets cannot be rehearsed on a local Hardhat chain); the proof view shows the authority line.

## 6. Out of scope

- Group purchasing or splitting paid bundles (that was BUNDLEBREAK, a different idea).
- Per-section or per-member scoped permissions (deferred).
- Arbitrary SaaS import, attachments, rich text, real-time collaborative editing, accounts and billing.
- Tokens, NFTs, bridges, iBridge, cross-VM calls, DaaS, AI features.
- Trust-minimized light-client verification. Restore trusts a named Portaldot RPC endpoint and says so in the UI.
- Key recovery and key rotation for already-copied plaintext. Revocation stops future writes; it cannot erase what a vendor already decrypted (Vendor A never holds the key, which limits this). F9 restores authority, and its key path hands the existing key to the inheritor. It does not re-key.
- Any protocol fee, toll or profit share inside the contract. A toll in the exit path would contradict "the vendor cannot hold you hostage".
- Scheduler-based automatic failover. It needs a privileged origin (the old source uses `EnsureRoot`), and no inactivity detector is promised.

### Future (recorded, not built)

- Owner passkey sign-in (WebAuthn) once a verified account-abstraction or P-256 path exists on Portaldot. There is currently no verified ERC-4337 EntryPoint, P-256 precompile or native passkey path on V3, and StableTap's passkey claim is UNVERIFIED. An app-side passkey unlock of the workspace key is possible without chain support. Members already need no wallet (F4).

## 7. What judges should see (rubric mapping)

| Criterion (weight) | Evidence we will show |
| --- | --- |
| Technical feasibility (30%) | Deployed contract, real tx hashes, green CI, Playwright run of the full demo, continuous commit history |
| Innovation (30%) | Authority transfer away from a vendor, not just export; contract enforces stale-write and revoked-writer refusal |
| Ecosystem contribution (20%) | Reusable SDK + open bundle format + contract any Portaldot app can integrate; documented Portaldot deployment lessons |
| Business potential (20%) | Open core: contract, SDK and bundle format free (MIT); app builders pay per workspace for the services below |

### Business model (open core)

The contract, SDK and bundle format stay free under MIT, with no fee or profit share in the contract. App builders pay per workspace for:

1. Managed independent replica and escrow hosting.
2. Importers and adapters from existing tools.
3. Exit drills and a signed "exit-readiness report" a buyer can show procurement.
4. Succession setup and support (F9).

Pricing and demand are UNVERIFIED.

## 8. Prior art and our delta

- **PortalAnchor** (Portaldot entrant, Middleware): anchors Merkle roots of records as logs. No owner, permissions, canonical head or continued writing. Our delta: authority and continuation, not anchoring.
- **Ceramic / ComposeDB, OrbitDB**: user-controlled streams and verifiable logs already exist. We do not claim to invent data ownership. Our delta: a small Portaldot-native exit kit demonstrated end to end, including a new accepted write after vendor shutdown.
- **Ordinary export/backup**: preserves files, not authority.
- **Safe plus a recovery module on other EVM chains** can do social recovery of a contract owner [inference]. Our F9 delta is reusing the chain's native Recovery authority across native and EVM apps, instead of a per-app recovery contract.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Testnet funding or deployment blocked | Request tokens immediately (OPEN-DECISIONS B1); keep contract small; dry-run first |
| Storage deposits too costly | Minimal state (owner, epoch, count, head, writer flags); history in events |
| `eth_getLogs` limits on Portaldot RPC | Spike in Phase 1; fall back to per-index reads if needed |
| "Why blockchain" challenged | Show the replace-contract-with-database argument and the vendor rejection on stage |
| Demo depends on perfect live network | Recorded backup run with real tx hashes; local-chain E2E for rehearsal |
| F9 native origin does not reach the contract as `H160(W)`, or Recovery is filtered | Read-only prep first (BUILD-PLAN 10.0), then a funded gate (10.1) that runs only after 1.4. If the gate fails, cut Act 3. Acts 1 and 2 never depend on it |

## 10. Glossary

- **Workspace:** one shared journal, identified by `wsId`.
- **Operation (op):** one change (create issue, set status, add comment), encrypted into an **envelope**.
- **Digest:** keccak256 of the envelope bytes.
- **Head:** running hash over all digests in order, maintained by the contract.
- **Epoch:** writer generation; rotating it revokes every writer of the previous epoch.
- **Bundle:** exported file of envelopes plus the chain checkpoint they must match.
- **Vendor A / Client B:** the original hosted app and the independent app that takes over.
