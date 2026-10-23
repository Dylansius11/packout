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

## 6. Out of scope

- Group purchasing or splitting paid bundles (that was BUNDLEBREAK, a different idea).
- Per-section or per-member scoped permissions (deferred).
- Arbitrary SaaS import, attachments, rich text, real-time collaborative editing, accounts and billing.
- Tokens, NFTs, bridges, iBridge, cross-VM calls, DaaS, AI features.
- Trust-minimized light-client verification. Restore trusts a named Portaldot RPC endpoint and says so in the UI.
- Key recovery and key rotation for already-copied plaintext. Revocation stops future writes; it cannot erase what a vendor already decrypted (Vendor A never holds the key, which limits this).

## 7. What judges should see (rubric mapping)

| Criterion (weight) | Evidence we will show |
| --- | --- |
| Technical feasibility (30%) | Deployed contract, real tx hashes, green CI, Playwright run of the full demo, continuous commit history |
| Innovation (30%) | Authority transfer away from a vendor, not just export; contract enforces stale-write and revoked-writer refusal |
| Ecosystem contribution (20%) | Reusable SDK + open bundle format + contract any Portaldot app can integrate; documented Portaldot deployment lessons |
| Business potential (20%) | App builders pay for managed replicas, adapters and exit drills; open format stays free |

## 8. Prior art and our delta

- **PortalAnchor** (Portaldot entrant, Middleware): anchors Merkle roots of records as logs. No owner, permissions, canonical head or continued writing. Our delta: authority and continuation, not anchoring.
- **Ceramic / ComposeDB, OrbitDB**: user-controlled streams and verifiable logs already exist. We do not claim to invent data ownership. Our delta: a small Portaldot-native exit kit demonstrated end to end, including a new accepted write after vendor shutdown.
- **Ordinary export/backup**: preserves files, not authority.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Testnet funding or deployment blocked | Request tokens immediately (OPEN-DECISIONS B1); keep contract small; dry-run first |
| Storage deposits too costly | Minimal state (owner, epoch, count, head, writer flags); history in events |
| `eth_getLogs` limits on Portaldot RPC | Spike in Phase 1; fall back to per-index reads if needed |
| "Why blockchain" challenged | Show the replace-contract-with-database argument and the vendor rejection on stage |
| Demo depends on perfect live network | Recorded backup run with real tx hashes; local-chain E2E for rehearsal |

## 10. Glossary

- **Workspace:** one shared journal, identified by `wsId`.
- **Operation (op):** one change (create issue, set status, add comment), encrypted into an **envelope**.
- **Digest:** keccak256 of the envelope bytes.
- **Head:** running hash over all digests in order, maintained by the contract.
- **Epoch:** writer generation; rotating it revokes every writer of the previous epoch.
- **Bundle:** exported file of envelopes plus the chain checkpoint they must match.
- **Vendor A / Client B:** the original hosted app and the independent app that takes over.
