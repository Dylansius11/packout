// Final copy for the pitch deck, one object per slide. Every string is verbatim from
// scratch/deck-copy.md. Block links reuse the landing's helpers; nothing here is invented.

import { block, demoRun, REGISTRY, short } from '../content';

/** A headline line: plain text, then at most one amber word. */
export interface HeadlineLine {
  readonly text: string;
  readonly accent?: string;
}

/** The visible label of a source link is the link's own hostname. */
export const srcLabel = (href: string) => new URL(href).hostname.replace(/^www\./, '');

export const SLIDE_COUNT = 12;

/** Short slide names for `aria-label` and the live region ("Slide 6 of 12: Why Portaldot"). */
export const slideTitles = [
  'Opening',
  'Problem',
  "Who it's for",
  'Solution',
  'Proof',
  'Why Portaldot',
  'Architecture',
  'Market',
  'Business model',
  'Comparison',
  'Team',
  'Close',
] as const;

export const opening = {
  eyebrow: 'PACKOUT · PITCH DECK',
  event: 'Portaldot Hacker House 2026 · Modular Cloud & Middleware',
  lines: [
    { text: 'Your vendor can quit.' },
    { text: 'Your workspace' },
    { text: '', accent: "won't." },
  ] satisfies HeadlineLine[],
  sub: 'An exit kit for shared workspaces. Restore the full history anywhere, check every change on Portaldot, keep writing under the same owner.',
  chips: [
    { text: '6 OF 6 CHECKS' },
    { text: 'PORTALDOT TESTNET' },
    { text: 'VENDOR REFUSED: NOTWRITER, BLOCK 238210', href: block(demoRun.refusal) },
  ],
  hint: 'Press → or swipe to begin',
} as const;

export const problem = {
  eyebrow: '01 · PROBLEM',
  headline: "Your team's history lives in someone else's database.",
  cards: [
    {
      year: '2019',
      product: 'Atlassian Stride',
      line: 'Discontinued 15 Feb 2019. Team chat and its integrations lost their host.',
      src: 'https://community.developer.atlassian.com/t/less-than-30-days-until-stride-and-hipchat-cloud-are-discontinued/26540',
    },
    {
      year: '2024',
      product: 'Skiff',
      line: 'Mail, Pages, Calendar and Drive sunset 9 Aug 2024 after the Notion acquisition.',
      src: 'https://skiff.com/data-migration',
    },
    {
      year: '2024',
      product: 'Slack free workspaces',
      line: 'From 26 Aug 2024, messages and files older than a year are deleted. A policy change, not a shutdown.',
      src: 'https://slack.com/help/articles/29414264463635-Updates-to-message-and-file-history-on-free-workspaces',
    },
    {
      year: '2025',
      product: 'Pocket',
      line: 'Shut down 8 Jul 2025.',
      src: 'https://support.mozilla.org/en-US/kb/future-of-pocket',
    },
  ],
  evidence: {
    count: 8,
    of: ' of 9',
    line: 'interviewed users called Packout super useful.',
    caption: 'Founder-run interviews · n = 9 · self-reported',
  },
  punchline: 'Export gives you files. It gives you no proof, and no right to keep writing.',
} as const;

export const audience = {
  eyebrow: "02 · WHO IT'S FOR",
  headline: 'Three people. One buyer.',
  cards: [
    {
      tag: 'OWNER',
      title: 'Team lead',
      line: 'Owns the workspace. Wants to leave a vendor without losing the history.',
    },
    {
      tag: 'WRITER',
      title: 'Member',
      line: 'Writes issues and comments. Never touches a wallet.',
    },
    {
      tag: 'BUYER',
      title: 'App builder',
      line: 'Adds an exit-proof promise to a product with one SDK. This is who pays.',
    },
  ],
  bottom:
    'Starting point: shared tools where the history is the asset, such as issue trackers, wikis and CRMs. A plan, not traction.',
} as const;

export const solution = {
  eyebrow: '03 · SOLUTION',
  headline: 'Write. Anchor. Leave. Take over.',
  steps: [
    {
      title: 'Write',
      line: "Every change is encrypted on the member's device before it goes anywhere.",
    },
    {
      title: 'Anchor',
      line: 'Portaldot records each change in order. A head chain, never the content.',
    },
    {
      title: 'Leave',
      line: 'Export a bundle and a key. Packout Restore runs six checks, each pass or fail.',
    },
    {
      title: 'Take over',
      line: "One rotateEpoch transaction. The vendor's next write is refused: NotWriter.",
    },
  ],
  footer: 'No wallet for members. No fee in the contract. An open bundle format.',
} as const;

export const proof = {
  eyebrow: '04 · PROOF',
  headline: 'Not a mock-up. Real transactions.',
  stats: [
    { value: 6, suffix: ' / 6', text: 'checks passed in a hosted browser run' },
    {
      value: 289771,
      text: "block where the owner's takeover finalized",
      href: block(289771),
    },
    {
      value: 238210,
      text: "block of the vendor's refused write: NotWriter",
      href: block(238210),
    },
    { value: 416, text: 'unit tests, plus end to end runs on testnet' },
  ],
  stale: 'A stale export is refused at "Complete history".',
  registry: {
    before: `Registry ${short(REGISTRY)}, deployed in `,
    link: 'block 238168',
    after: '.',
    href: block(238168),
  },
  commandLabel: 'Check an export yourself',
  command: 'npx @packout/verify bundle.json --key key.txt',
  src: 'https://github.com/Dylansius11/packout/blob/main/docs/technical/SMART-CONTRACT.md',
} as const;

export const portaldot = {
  eyebrow: '05 · WHY PORTALDOT',
  headline: 'Portaldot is the referee.',
  sub: 'The chain does not store the workspace. It decides who owns it, who may write, and what came first.',
  cards: [
    {
      fact: 'EVM bytecode accepted',
      line: 'A plain Solidity registry, deployed in block 238168.',
    },
    {
      fact: 'Native Recovery pallet',
      line: "A 2-of-3 friend group and an inheritance delay can restore the owner's authority.",
    },
    {
      fact: 'One identity, native and EVM',
      line: 'msg.sender is the same owner either way, so no ownership-transfer function is needed.',
    },
    {
      fact: 'History in events',
      line: 'A later append cost 0.031 tPOT. Storage deposits push history into events.',
    },
  ],
  limitsLabel: 'Limits',
  limits:
    'About 6 s blocks, with finalized shown apart from included. Reads trust named RPCs, not a light client. Succession is proven from scripts; the browser panel is not built yet.',
  other:
    'Another EVM chain could host a registry. Portaldot adds native Recovery under the same owner.',
  src: 'https://github.com/Dylansius11/packout/blob/main/docs/technical/INTEGRATIONS.md',
} as const;

export const architecture = {
  eyebrow: '06 · ARCHITECTURE',
  headline: 'A small chain. A vendor that sees only ciphertext. An independent client.',
  nodes: {
    members: { title: 'Members', note: 'no wallet' },
    vendor: { title: 'Vendor A', note: 'stores ciphertext only' },
    registry: {
      title: 'Portaldot registry',
      note: 'owner · epoch · count · head',
      sub: 'events carry the digests',
    },
    bundle: { title: 'Bundle + key', note: 'a file, passed by hand' },
    restore: { title: 'Packout Restore', note: 'six checks · never calls the vendor' },
  },
  edges: {
    change: 'encrypted change',
    append: 'appendBatch',
    exportBundle: 'export',
    reads: 'reads and checks',
    rotate: 'rotateEpoch, then new writes',
  },
  boundary: 'no code path',
  pills: ['@packout/sdk', '@packout/verify'],
  pillsNote: 'two independent implementations, same heads',
  formula: 'head_i = keccak256(HEAD_DOMAIN, wsId, i, head_(i-1), digest_i)',
  callouts: [
    'The vendor sees ciphertext only.',
    'The chain sees digests and order only.',
    'Restore never calls the vendor. A test enforces it.',
  ],
} as const;

export const market = {
  eyebrow: '07 · MARKET',
  headline: 'A large SaaS economy. A growing duty to allow exit.',
  context: {
    value: 375.6,
    prefix: '$',
    suffix: 'B',
    line: 'forecast global SaaS market, 2026',
    src: 'https://www.giiresearch.com/report/fbs1930172-software-service-market-size-share-growth-global.html',
  },
  rules: [
    {
      name: 'EU Data Act',
      line: 'Applies since 12 Sep 2025. Switching charges end 12 Jan 2027.',
      src: 'https://eur-lex.europa.eu/eli/reg/2023/2854/oj/eng',
    },
    {
      name: 'EU DORA',
      line: 'Exit strategies required for critical ICT services since 17 Jan 2025.',
      src: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng',
    },
  ],
  funnelLabel: 'Planning scenario for 2027',
  funnel: [
    {
      tier: 'TAM',
      value: 432,
      prefix: '$',
      suffix: 'M',
      tail: '',
      line: '72,000 SaaS company records × 100 workspaces × $5 per month × 12',
      width: 100,
    },
    {
      tier: 'SAM',
      value: 21.6,
      prefix: '$',
      suffix: 'M',
      tail: '',
      line: '5% fit for a collaboration or issue-workspace product',
      width: 60,
    },
    {
      tier: 'SOM',
      value: 120,
      prefix: '$',
      suffix: 'K',
      tail: ' ARR',
      line: '20 paying vendors, 2,000 workspaces',
      width: 30,
    },
  ],
  caption:
    'Only the 72,000 company records are sourced (GetLatka, 2026). Workspaces per vendor, price, fit and the 20 vendors are assumptions to validate.',
  closing: "Portaldot first. The buyer is every SaaS vendor, not only Portaldot's ecosystem.",
} as const;

export const business = {
  eyebrow: '08 · BUSINESS MODEL',
  headline: 'Free exit protocol. Paid continuity.',
  free: {
    label: 'FREE AND OPEN',
    items: ['Registry contract', 'SDK', 'Bundle format', 'Verifier'],
    note: 'No toll in the contract. No fee to exercise an exit.',
  },
  paid: {
    label: 'PAID, PER WORKSPACE',
    items: [
      'Managed independent replica',
      'Importers from existing tools',
      'Exit drills and a signed exit-readiness report',
      'Succession setup',
    ],
  },
  price: 'Planning price: $5 per workspace per month. An assumption, not yet validated.',
  benchmark: {
    before:
      'Paid continuity is already a category: SaaS escrow lists from $199 per month per application (',
    codekeeper: 'Codekeeper, 2026',
    middle: ') and SaaS access continuity at $5,995 per year (',
    escrow: 'Escrow London',
    after: ').',
    codekeeperSrc: 'https://codekeeper.co/pricing/saas-escrow',
    escrowSrc: 'https://www.escrowlondon.com/how-much-does-software-escrow-cost-usa/',
  },
} as const;

export type Mark = 'yes' | 'partial' | 'no';

export const comparison = {
  eyebrow: '09 · COMPARISON',
  headline: 'Others store or sync. Packout lets you leave and keep going.',
  columns: [
    'Packout',
    'Ceramic / ComposeDB',
    'OrbitDB',
    'Safe + recovery module',
    'Ordinary export',
  ],
  rows: [
    {
      criterion: 'Ordered history anyone can verify',
      marks: ['yes', 'yes', 'yes', 'no', 'no'],
    },
    {
      criterion: 'Owner authority enforced by a chain',
      marks: ['yes', 'partial', 'partial', 'yes', 'no'],
    },
    {
      criterion: "Old vendor's writes refused after exit",
      marks: ['yes', 'partial', 'no', 'partial', 'no'],
    },
    {
      criterion: 'Restore in an independent app',
      marks: ['yes', 'yes', 'yes', 'no', 'partial'],
    },
    {
      criterion: 'Keep writing in the same workspace after exit',
      marks: ['yes', 'partial', 'yes', 'no', 'no'],
    },
    {
      criterion: 'Turnkey exit kit for app builders',
      marks: ['yes', 'no', 'no', 'no', 'no'],
    },
  ] satisfies { criterion: string; marks: Mark[] }[],
  legend: 'yes = offered · partial = possible, you build it · no = not offered',
  footnote:
    'Comparison from public documentation reviewed 3 Nov 2026. It is our reading, not a benchmark.',
  srcs: [
    'https://blog.ceramic.network/composedb-using-ceramic-as-a-graph-database/',
    'https://github.com/orbitdb/orbitdb',
    'https://safefoundation.org/blog/introducing-candides-social-recovery',
  ],
} as const;

export const team = {
  name: 'Dylansius Putra Prasetio',
  role: 'FOUNDER · PRODUCT AND FULL-STACK',
  eyebrow: '10 · TEAM',
  headline: [{ text: 'Ships. Sells. ', accent: 'Wins.' }] satisfies HeadlineLine[],
  stats: [
    { count: 6, suffix: '+', line: 'hackathon wins and finals' },
    { count: 5, suffix: '+', line: 'paid systems sold' },
    { text: '1st', line: 'BNB Indonesia hackathon' },
  ],
  rows: [
    { label: 'BNB INDONESIA', value: '1st place' },
    { label: 'ETHONLINE', value: 'Sponsor prize' },
    { label: 'COINFEST ASIA', value: 'Hackathon runner-up' },
    { label: 'CRESCENS LABS', value: 'Founder, paid systems' },
  ],
  small: 'Built with AI coding agents under written rules. The founder directs, decides and tests.',
  lookingFor: {
    label: 'LOOKING FOR',
    items: ['Smart-contract security review', 'One pilot app builder'],
  },
} as const;

export const close = {
  eyebrow: '11 · CLOSE',
  lines: [
    { text: 'Your vendor can quit.' },
    { text: 'Your workspace ', accent: "won't." },
  ] satisfies HeadlineLine[],
  asks: [
    {
      from: 'FROM PORTALDOT',
      line: 'Continued support and ecosystem introductions.',
    },
    {
      from: 'FROM BUILDERS',
      line: 'One pilot: a team that wants an exit-proof workspace.',
    },
  ],
  plannedLabel: 'PLANNED · NEXT 90 DAYS',
  planned: [
    'MCP server for agents',
    'packout CLI: init, export, drill',
    'Succession panel in the browser',
    'First pilot',
  ],
  links: [
    { label: 'Landing', href: 'https://packout-site.vercel.app' },
    { label: 'Demo vendor', href: 'https://packout-vendor-a.vercel.app' },
    { label: 'Packout Restore', href: 'https://packout-restore.vercel.app' },
    { label: 'GitHub', href: 'https://github.com/Dylansius11/packout' },
    { label: 'npm: @packout/sdk', href: 'https://www.npmjs.com/package/@packout/sdk' },
    { label: 'npm: @packout/verify', href: 'https://www.npmjs.com/package/@packout/verify' },
  ],
  footer: 'Portaldot testnet only · Built for Portaldot Hacker House 2026',
  print: 'Print / save as PDF',
} as const;
