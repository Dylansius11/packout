import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { links } from '../content';
import { gutter, SectionHeading } from '../ui';

const INSTALL = 'npm i @packout/sdk viem';

const SNIPPET = `import { createRegistryReader, verifyBundle } from '@packout/sdk';

// client: a viem PublicClient for Portaldot; registry: the contract address
const reader = createRegistryReader({ client, registry });
const report = await verifyBundle({ bundle, key, chain: reader });
console.log(report.ok, report.steps.map((step) => \`\${step.id}: \${step.status}\`));`;

const VERIFY = 'npx @packout/verify bundle.json --key key.txt';

const SKILL = `npx skills add ${links.code} --skill packout`;

const shipped = [
  'Registry contract on Portaldot testnet',
  'SDK',
  'Open bundle format',
  'Independent verifier CLI',
  'Agent skill',
];

const planned = ['MCP server for agents', 'packout CLI: init, export, drill', 'Managed replica'];

type CopyState = 'idle' | 'copied' | 'failed';

/** A command you can read, select and copy. A failed copy selects the text and says so. */
function CommandBlock({ label, text }: { label: string; text: string }) {
  const code = useRef<HTMLElement>(null);
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state !== 'copied') return;
    const timer = window.setTimeout(() => setState('idle'), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      const node = code.current;
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setState('failed');
    }
  }

  return (
    <div className="mt-4 max-w-[52rem]">
      <div className="flex items-center justify-between gap-4">
        <span className="baseline depth-2 text-[11px]">{label}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="command baseline inline-flex min-h-11 items-center text-[12px] text-ash transition-colors duration-150 hover:text-ivory active:scale-[0.97]"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto py-2 font-pixel text-[12px] leading-[1.9] whitespace-pre-wrap break-words text-ivory md:text-[13px]">
        <code ref={code}>{text}</code>
      </pre>
      <p
        role="status"
        aria-live="polite"
        className="baseline depth-2 min-h-[1.45em] text-[11px] whitespace-normal"
      >
        {state === 'copied' ? 'Copied' : null}
        {state === 'failed' ? 'Copy failed. The text is selected: press Ctrl+C or Cmd+C.' : null}
      </p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-x-4">
      <span className="baseline pt-1 text-[13px] text-smoke">{String(n).padStart(2, '0')}</span>
      <div>
        <h4 className="baseline depth-0 text-[13px] whitespace-normal">{title}</h4>
        {children}
      </div>
    </li>
  );
}

const tabs = [
  { id: 'human', label: 'Human' },
  { id: 'agent', label: 'Agent' },
] as const;
type TabId = (typeof tabs)[number]['id'];

export function Build() {
  const base = useId();
  const [active, setActive] = useState<TabId>('human');
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ human: null, agent: null });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const id = tabs[next].id;
    setActive(id);
    refs.current[id]?.focus();
  }

  return (
    <section
      id="build"
      aria-labelledby="build-heading"
      className={`${gutter} scroll-mt-8 py-[clamp(5rem,10vw,8rem)]`}
    >
      <SectionHeading id="build-heading">Build with Packout.</SectionHeading>
      <p className="prose-ash mt-6">
        Add the exit to your own workspace app. Wire the SDK yourself, or hand the job to your
        coding agent.
      </p>

      <div
        role="tablist"
        aria-label="Who is integrating"
        onKeyDown={onKeyDown}
        className="mt-12 flex gap-8"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={`baseline inline-flex min-h-11 items-center text-[14px] tracking-[0.12em] underline decoration-1 underline-offset-[0.5em] transition-colors duration-150 ${
                selected
                  ? 'text-ivory decoration-ivory'
                  : 'text-smoke decoration-transparent hover:text-ivory'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel-human`}
        aria-labelledby={`${base}-tab-human`}
        hidden={active !== 'human'}
        className="mt-8"
      >
        <ol className="space-y-10">
          <Step n={1} title="Install the SDK">
            <CommandBlock label="Install" text={INSTALL} />
          </Step>
          <Step n={2} title="Check a workspace from code">
            <CommandBlock label="TypeScript" text={SNIPPET} />
          </Step>
          <Step n={3} title="Or check an export from a terminal">
            <CommandBlock label="Verify a bundle" text={VERIFY} />
            <p className="max-w-[52ch] text-[14px] leading-relaxed text-smoke">
              The verifier shares no code with the SDK. Without the key file, decryption is reported
              as skipped, never as passed.
            </p>
          </Step>
        </ol>
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel-agent`}
        aria-labelledby={`${base}-tab-agent`}
        hidden={active !== 'agent'}
        className="mt-8"
      >
        <p className="prose-ash">
          The skill teaches your coding agent to integrate the SDK, add an exit path to your app and
          verify a bundle against the chain.
        </p>
        <CommandBlock label="Add the skill" text={SKILL} />
      </div>

      <div className="mt-20 grid gap-x-16 gap-y-10 md:grid-cols-2">
        <div>
          <h3 className="baseline depth-0 text-[14px]">Shipped</h3>
          <ul className="mt-4 space-y-2 text-[16px] leading-relaxed text-ash">
            {shipped.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="baseline depth-2 text-[14px]">Planned</h3>
          <ul className="mt-4 space-y-2 text-[16px] leading-relaxed text-smoke">
            {planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="baseline depth-2 mt-4 text-[11px] whitespace-normal">
            Not built yet. None of these is available today.
          </p>
        </div>
      </div>

      <p className="mt-14 max-w-[60ch] text-[16px] leading-relaxed text-ash">
        The full guide is in the{' '}
        <a href={`${links.code}#readme`} className="ghost-link text-[14px]">
          repository README
        </a>
        .
      </p>
    </section>
  );
}
