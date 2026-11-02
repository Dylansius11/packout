import { DustField } from '@packout/brand';
import { type CSSProperties, useId, useState } from 'react';
import { Aurora } from '../components/aurora';
import { CommandBlock } from '../components/command-block';
import { PillToggle, pillIds } from '../components/pill-toggle';
import { demoRun, links } from '../content';
import { gutter } from '../ui';

const audiences = [
  { id: 'human', label: 'Human' },
  { id: 'agent', label: 'Agent' },
] as const;
type Audience = (typeof audiences)[number]['id'];

const commands: Record<Audience, { text: string; note: string }> = {
  human: {
    text: 'npx @packout/verify bundle.json --key key.txt',
    note: 'Check an export against Portaldot from any terminal.',
  },
  agent: {
    text: `npx skills add ${links.code} --skill packout`,
    note: 'Teaches your coding agent to add the exit to your app.',
  },
};

/** Real facts only; each one is evidenced further down the page. */
function TrustRow() {
  const chip =
    'baseline inline-flex min-h-11 items-center gap-2.5 rounded-full border border-hair-strong bg-black/55 px-4 pt-0.5 text-[11px] tracking-[0.12em] text-ivory md:min-h-9';
  const dot = <span aria-hidden="true" className="size-1.5 bg-signal" />;
  return (
    <ul className="surface flex flex-wrap gap-2.5" style={{ '--order': 4 } as CSSProperties}>
      <li className={chip}>{dot}6 of 6 checks</li>
      <li className={chip}>{dot}Portaldot testnet</li>
      <li>
        <a
          href={`https://scanner-testnet-v3.portaldot.dev/#/blocks/${demoRun.refusal}`}
          target="_blank"
          rel="noreferrer"
          className={`${chip} transition-colors duration-150 hover:border-signal/70`}
        >
          {dot}NotWriter, block {demoRun.refusal}
          <span className="sr-only"> on the Portaldot explorer (opens in a new tab)</span>
        </a>
      </li>
    </ul>
  );
}

export function Hero() {
  const base = useId();
  const [audience, setAudience] = useState<Audience>('human');

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative isolate -mt-16 flex min-h-[min(100svh,58rem)] flex-col overflow-hidden pt-16"
    >
      <Aurora className="-z-30" />
      <DustField
        className="absolute inset-0 -z-20 h-full w-full"
        anchor="end"
        mirror
        intensity={0.2}
      />
      {/* Reading text never sits on the glow: the void closes in from the left and from below. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#000_0%,rgb(0_0_0/0.86)_36%,transparent_74%)] max-md:bg-[linear-gradient(to_bottom,rgb(0_0_0/0.9)_0%,rgb(0_0_0/0.78)_70%,rgb(0_0_0/0.4)_100%)]"
      />

      <div className={`${gutter} flex flex-1 items-center py-12 md:py-20`}>
        <div className="mx-auto w-full max-w-[84rem]">
          <div className="max-w-[56rem]">
            <p className="eyebrow surface">
              <span>Packout</span>
              <span aria-hidden="true" className="text-mist">
                |
              </span>
              <span>Exit kit for shared workspaces</span>
            </p>
            <h1
              id="hero-heading"
              className="display surface mt-6 text-[clamp(2.5rem,6vw,5.5rem)] text-ivory"
              style={{ '--order': 1 } as CSSProperties}
            >
              <span className="block">Your vendor can quit.</span>
              <span className="block">
                Your workspace <span className="text-signal">won't.</span>
              </span>
            </h1>
            <p className="prose surface mt-7" style={{ '--order': 2 } as CSSProperties}>
              Restore the full history in an independent app, check every change against Portaldot,
              and keep writing in the same workspace while the old vendor stays locked out.
            </p>

            <div className="surface mt-9 max-w-[40rem]" style={{ '--order': 3 } as CSSProperties}>
              <PillToggle
                options={audiences}
                value={audience}
                onChange={setAudience}
                label="Who is reading"
                idBase={base}
              />
              <div className="mt-4 grid">
                {audiences.map((option) => {
                  const ids = pillIds(base, option.id);
                  const active = option.id === audience;
                  return (
                    <div
                      key={option.id}
                      role="tabpanel"
                      id={ids.panel}
                      aria-labelledby={ids.tab}
                      className={`[grid-area:1/1] ${active ? '' : 'invisible'}`}
                    >
                      <CommandBlock text={commands[option.id].text} />
                      <p className="-mt-1 text-[14px] leading-relaxed text-ash">
                        {commands[option.id].note}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="surface mt-7 flex flex-wrap items-center gap-x-6 gap-y-4"
              style={{ '--order': 4 } as CSSProperties}
            >
              <a href={links.vendor} className="signal text-[13px]">
                Run the exit
                <span aria-hidden="true" data-arrow>
                  →
                </span>
              </a>
              <a href={links.restore} className="pill">
                Open Packout Restore
              </a>
            </div>

            <div className="mt-9">
              <TrustRow />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
