import { type ReactNode, useId, useState } from 'react';
import { CommandBlock } from '../components/command-block';
import { CheckIcon } from '../components/icons';
import { PillToggle, pillIds } from '../components/pill-toggle';
import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { links } from '../content';

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

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-x-4">
      <span className="numeral pt-0.5 text-[20px]">{String(n).padStart(2, '0')}</span>
      <div>
        <h4 className="baseline whitespace-normal text-[14px] text-ivory">{title}</h4>
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
  const human = pillIds(base, 'human');
  const agent = pillIds(base, 'agent');

  return (
    <Section
      id="build"
      n="09"
      label="Build with Packout"
      headingId="build-heading"
      heading="Build with Packout."
    >
      <Pull className="mt-8">
        Wire the SDK yourself, or <mark>hand the job to your coding agent</mark>.
      </Pull>
      <Reveal delay={100}>
        <p className="prose mt-6">Add the exit to your own workspace app.</p>
      </Reveal>

      <Reveal delay={140} className="mt-10">
        <PillToggle
          options={tabs}
          value={active}
          onChange={setActive}
          label="Who is integrating"
          idBase={base}
        />

        <div
          role="tabpanel"
          id={human.panel}
          aria-labelledby={human.tab}
          hidden={active !== 'human'}
          className="mt-8 max-w-[52rem]"
        >
          <ol className="space-y-10">
            <Step n={1} title="Install the SDK">
              <CommandBlock label="Install" text={INSTALL} className="mt-4" />
            </Step>
            <Step n={2} title="Check a workspace from code">
              <CommandBlock label="TypeScript" text={SNIPPET} prompt={false} className="mt-4" />
            </Step>
            <Step n={3} title="Or check an export from a terminal">
              <CommandBlock label="Verify a bundle" text={VERIFY} className="mt-4" />
              <p className="max-w-[52ch] text-[14px] leading-relaxed text-ash">
                The verifier shares no code with the SDK. Without the key file, decryption is
                reported as skipped, never as passed.
              </p>
            </Step>
          </ol>
        </div>

        <div
          role="tabpanel"
          id={agent.panel}
          aria-labelledby={agent.tab}
          hidden={active !== 'agent'}
          className="mt-8 max-w-[52rem]"
        >
          <p className="prose">
            The skill teaches your coding agent to integrate the SDK, add an exit path to your app
            and verify a bundle against the chain.
          </p>
          <CommandBlock label="Add the skill" text={SKILL} className="mt-5" />
        </div>
      </Reveal>

      <Reveal delay={60} className="mt-20 grid gap-4 md:grid-cols-2">
        <div className="card p-6 md:p-8">
          <h3 className="baseline text-[14px] text-ivory">Shipped</h3>
          <ul className="mt-5 space-y-3 text-[16px] leading-snug text-ivory">
            {shipped.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-signal" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.25rem] border border-dashed border-hair-strong p-6 md:p-8">
          <h3 className="baseline depth-1 text-[14px]">Planned</h3>
          <ul className="mt-5 space-y-3 text-[16px] leading-snug text-mist">
            {planned.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[0.45em] size-1.5 shrink-0 border border-ash"
                />
                {item}
              </li>
            ))}
          </ul>
          <p className="baseline depth-1 mt-5 whitespace-normal text-[11px]">
            Not built yet. None of these is available today.
          </p>
        </div>
      </Reveal>

      <p className="mt-14 max-w-[60ch] text-[16px] leading-relaxed text-mist">
        The full guide is in the{' '}
        <a href={`${links.code}#readme`} className="ghost-link text-[14px]">
          repository README
        </a>
        .
      </p>
    </Section>
  );
}
