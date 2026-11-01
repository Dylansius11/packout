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
