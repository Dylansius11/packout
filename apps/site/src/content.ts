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
    body: 'One file of ciphertext and a checkpoint. The key never goes in it, so the file is safe to keep anywhere.',
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
  { what: 'Each append after the first', value: '0.031 tPOT', height: demoRun.ownerAppend },
  { what: 'Vendor comeback', value: 'reverted, NotWriter', height: demoRun.refusal },
  { what: 'Inherited takeover, same owner', value: 'outer and inner Ok', height: 248474 },
  { what: 'Vendor refused after recovery', value: 'NotWriter, epoch 2', height: 248482 },
];
