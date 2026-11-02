// Every number, hash and block below was observed on Portaldot testnet and is recorded in
// docs/technical/SMART-CONTRACT.md (sections 8 and 9). Nothing on this page is invented.

const env = import.meta.env;
export const links = {
  vendor: env.VITE_VENDOR_APP_URL || 'http://localhost:5173',
  restore: env.VITE_RESTORE_APP_URL || 'http://localhost:5174',
  code: 'https://github.com/Dylansius11/packout',
} as const;

const EXPLORER = 'https://scanner-testnet-v3.portaldot.dev';
export const block = (height: number) => `${EXPLORER}/#/blocks/${height}`;

export const REGISTRY = '0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0';
export const DEMO_WORKSPACE = '0xf9997451ca021ee6f0ec7d6ce5aeb467372fc5e06ef4088b904feccc82b94649';

export const short = (hex: string) => `${hex.slice(0, 6)}…${hex.slice(-4)}`;

/** The pnpm demo:full run on 2026-10-29, in the order it happened. */
export const demoRun = {
  vendorAppend: 238201,
  takeover: 238204,
  ownerAppend: 238207,
  refusal: 238210,
} as const;

export interface Move {
  title: string;
  body: string;
  vendor: string;
  workspace: string;
}

export const moves: Move[] = [
  {
    title: 'Work like normal',
    body: 'Members write issues and comments in Vendor A with no wallet. Each change is encrypted on their device before the vendor ever sees it, then anchored on Portaldot.',
    vendor: 'online, writing',
    workspace: 'ops #0 to #2 anchored',
  },
  {
    title: 'Export',
    body: 'One file of encrypted history and a checkpoint, never the key. Keep a reliable copy, and keep the key somewhere else.',
    vendor: 'online',
    workspace: 'bundle.json saved',
  },
  {
    title: 'Pull the plug',
    body: 'We stop the vendor API process. A real outage, the kind you get when a startup runs out of runway.',
    vendor: 'offline',
    workspace: 'on your device',
  },
  {
    title: 'Restore somewhere else',
    body: 'Packout Restore has no code path to the vendor. It checks the file against Portaldot six ways before it shows you a single issue.',
    vendor: 'offline',
    workspace: 'verified, 6 of 6',
  },
  {
    title: 'Take over',
    body: 'The owner signs one transaction. From that block on, every old writer, the vendor included, is out.',
    vendor: 'access revoked',
    workspace: 'epoch 1',
  },
  {
    title: 'Keep writing',
    body: 'The next change lands as operation #3 of the same history. Not a copy, not a fork. The same workspace.',
    vendor: 'access revoked',
    workspace: 'op #3 anchored',
  },
  {
    title: 'The vendor comes back',
    body: 'It tries to write. The contract refuses with NotWriter, and the reverted transaction sits on the explorer for anyone to check.',
    vendor: 'refused on-chain',
    workspace: 'still yours',
  },
];

export type CheckId = 'format' | 'envelopes' | 'head' | 'anchored' | 'complete' | 'decrypt';

export const checks: { id: CheckId; title: string; asks: string; failure: string }[] = [
  {
    id: 'format',
    title: 'Bundle format',
    asks: 'Is this a Packout bundle, and does its count add up?',
    failure: 'Not a Packout bundle.',
  },
  {
    id: 'envelopes',
    title: 'Encrypted operations',
    asks: 'Is every operation a well-formed sealed envelope?',
    failure: 'An envelope is damaged.',
  },
  {
    id: 'head',
    title: 'History integrity',
    asks: 'Rehash every operation in order. Does the chain still meet the checkpoint?',
    failure: 'One flipped byte, and the head chain no longer matches.',
  },
  {
    id: 'anchored',
    title: 'Anchored on Portaldot',
    asks: 'Did the registry admit this exact last operation?',
    failure: 'Portaldot has no matching admission. This is not the history that was anchored.',
  },
  {
    id: 'complete',
    title: 'Complete history',
    asks: 'Is anything newer on-chain that this file is missing?',
    failure: 'This bundle is stale: 1 operation is missing from this file.',
  },
  {
    id: 'decrypt',
    title: 'Decrypt and read',
    asks: 'Does your key open every operation, here on this device?',
    failure: 'Operation 1 cannot be decrypted with this key.',
  },
];

export const tampers: { label: string; breaks: CheckId | null }[] = [
  { label: 'Untouched file', breaks: null },
  { label: 'Flip one byte', breaks: 'head' },
  { label: 'Drop an operation', breaks: 'anchored' },
  { label: 'Use an older export', breaks: 'complete' },
  { label: 'Wrong key', breaks: 'decrypt' },
];

export const record: { what: string; value: string; height?: number }[] = [
  { what: 'Registry contract', value: short(REGISTRY), height: 238168 },
  { what: 'Takeover, rotateEpoch', value: '0.021 tPOT', height: demoRun.takeover },
  {
    what: 'A later append, one operation, as measured',
    value: '0.031 tPOT',
    height: demoRun.ownerAppend,
  },
  { what: 'Vendor comeback', value: 'reverted, NotWriter', height: demoRun.refusal },
  { what: 'Inherited takeover, same owner', value: 'outer and inner Ok', height: 248474 },
  { what: 'Vendor refused after recovery', value: 'NotWriter, epoch 2', height: 248482 },
];

export const succession: { line: string; height?: number }[] = [
  { line: 'Two of three backup wallets approve', height: 248462 },
  { line: 'A waiting period the real owner can cancel (10 blocks in this test)' },
  { line: 'The inheritor rotates the epoch as the same owner', height: 248474 },
  { line: 'Two shares rebuild the encryption key, offline' },
  { line: 'The next operation lands in the same workspace', height: 248479 },
  { line: 'The old vendor tries again and is refused', height: 248482 },
];

/** Real output of the independent verifier against the Succession workspace, 2026-11-01. */
export const cliRun = {
  command: 'pnpm verify bundle.json --native-blocks native-blocks.json',
  lines: [
    ['PASS', 'Format', 'PACKOUT bundle v1 contains 6 operations with a matching checkpoint count.'],
    [
      'PASS',
      'Envelopes',
      'Every envelope has version 1, a 24-byte nonce and a 16-byte authentication tag.',
    ],
    [
      'PASS',
      'Head chain',
      'Recomputed envelope digests and the ordered head chain match the claimed checkpoint.',
    ],
    [
      'PASS',
      'Anchored on chain',
      'The registry admission at operation 6 matches the final digest and checkpoint head.',
    ],
    [
      'PASS',
      'Completeness',
      'The bundle contains all 6 operations admitted at the observed chain state.',
    ],
    [
      'SKIPPED',
      'Decrypt and read',
      'No key file was supplied; plaintext and journal operations were not checked.',
    ],
  ],
} as const;

const REPO = links.code;
/** A folder (`tree`) or a file (`blob`) on the repository's main branch. */
const tree = (path: string) => `${REPO}/tree/main/${path}`;
const file = (path: string) => `${REPO}/blob/main/${path}`;

const CONTRACT_DOC = 'docs/technical/SMART-CONTRACT.md';

/**
 * The numbers strip. Every value is a row of the README's "Packout in numbers" table, and each
 * one links to the section of the docs that holds its evidence.
 */
export const stats: {
  value: string;
  label: string;
  source: { text: string; href: string };
}[] = [
  {
    value: '6 of 6',
    label: 'checks pass on the real testnet bundle',
    source: { text: 'SMART-CONTRACT §9.1', href: `${file(CONTRACT_DOC)}#91-recorded-testnet-runs` },
  },
  {
    value: '6',
    label: 'transactions in the testnet exit story',
    source: { text: 'SMART-CONTRACT §9.1', href: `${file(CONTRACT_DOC)}#91-recorded-testnet-runs` },
  },
  {
    value: 'NotWriter',
    label: `the old vendor’s write reverted in block ${demoRun.refusal}`,
    source: { text: `Explorer, block ${demoRun.refusal}`, href: block(demoRun.refusal) },
  },
  {
    value: '2 of 3',
    label: 'backup wallets recover authority',
    source: {
      text: 'SMART-CONTRACT §9.3',
      href: `${file(CONTRACT_DOC)}#93-key-recovery-succession-demo-2026-10-30`,
    },
  },
  {
    value: '0.031 tPOT',
    label: 'one measured single-digest append',
    source: {
      text: 'SMART-CONTRACT §8',
      href: `${file(CONTRACT_DOC)}#8-cost-on-portaldot-testnet`,
    },
  },
  {
    value: '416',
    label: 'unit and integration tests',
    source: { text: 'README, in numbers', href: `${REPO}#packout-in-numbers` },
  },
];

export const resourceTags = ['SDK', 'VERIFY', 'AGENT', 'CONTRACT', 'DOCS'] as const;
export type ResourceTag = (typeof resourceTags)[number];

export interface Resource {
  title: string;
  what: string;
  tag: ResourceTag;
  /** Repository path, shown on the card. */
  path: string;
  href: string;
}

/** Real paths in the repository: folders open as `tree`, files as `blob`. */
export const resources: Resource[] = [
  {
    title: 'Agent skill',
    what: 'Teaches your coding agent to integrate the SDK, add an exit path and verify a bundle.',
    tag: 'AGENT',
    path: 'skills/packout',
    href: tree('skills/packout'),
  },
  {
    title: '@packout/sdk',
    what: 'Encrypt on the device, anchor in batches, export, verify and rebuild the workspace state.',
    tag: 'SDK',
    path: 'packages/sdk',
    href: tree('packages/sdk'),
  },
  {
    title: 'Verifier CLI',
    what: 'Written from the spec alone, sharing no code with the SDK.',
    tag: 'VERIFY',
    path: 'packages/verify',
    href: tree('packages/verify'),
  },
  {
    title: 'Registry contract',
    what: 'One small Solidity contract: owner, epoch, writers, count and head per workspace.',
    tag: 'CONTRACT',
    path: 'contracts',
    href: tree('contracts'),
  },
  {
    title: 'Architecture',
    what: 'Components, data placement, bundle format, the demo sequence and the trust model.',
    tag: 'DOCS',
    path: 'docs/technical/ARCHITECTURE.md',
    href: file('docs/technical/ARCHITECTURE.md'),
  },
  {
    title: 'Contract specification',
    what: 'Storage, head chain, functions, events, costs and the recorded testnet runs.',
    tag: 'CONTRACT',
    path: CONTRACT_DOC,
    href: file(CONTRACT_DOC),
  },
  {
    title: 'Integrations',
    what: 'Portaldot testnet facts, funding an EVM key, wallets and environment variables.',
    tag: 'DOCS',
    path: 'docs/technical/INTEGRATIONS.md',
    href: file('docs/technical/INTEGRATIONS.md'),
  },
  {
    title: 'Demo bundles',
    what: 'Where demo bundles and keys go, and how to check one before you present it.',
    tag: 'VERIFY',
    path: 'demo-kit',
    href: tree('demo-kit'),
  },
  {
    title: 'Design system',
    what: 'The tokens and components behind this page and Packout Restore.',
    tag: 'DOCS',
    path: 'DESIGN.md',
    href: file('DESIGN.md'),
  },
];
