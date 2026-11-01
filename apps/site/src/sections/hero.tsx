import { DustField, Wordmark } from '@packout/brand';
import { type CSSProperties, useEffect, useState } from 'react';
import { block, DEMO_WORKSPACE, demoRun, links, short } from '../content';
import { BlockLink, gutter } from '../ui';

const nav = [
  { href: '#exit', label: 'How it works' },
  { href: '#record', label: 'Proof' },
  { href: '#builders', label: 'Builders' },
];

/** Rear planes drift; each step forward halves the rate; the front plane holds still. */
const rearPlanes = [
  {
    depth: 'depth-3',
    rate: '34s',
    text: 'Vendor A stopped · the API process is gone · ',
  },
  {
    depth: 'depth-2',
    rate: '68s',
    text: `Ops #0 #1 #2 · written through Vendor A · anchored in block ${demoRun.vendorAppend} · contents encrypted, Portaldot sees fingerprints only · `,
  },
  {
    depth: 'depth-1',
    rate: '136s',
    text: `Owner signs rotateEpoch · block ${demoRun.takeover} · every old writer loses access · `,
  },
];

function Nav() {
  return (
    <nav aria-label="Primary" className={`${gutter} flex items-center justify-between py-6`}>
      <a href="#top" aria-label="Packout, back to top" className="text-ivory">
        <Wordmark size={16} drifting />
      </a>
      <div className="flex items-center gap-8">
        <ul className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="ghost-link text-[13px] no-underline">
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <a href={links.code} className="ghost-link text-[13px] no-underline">
              Code
            </a>
          </li>
        </ul>
        <a href={links.vendor} className="command text-[12px]">
          Run the exit
        </a>
      </div>
    </nav>
  );
}

/** Moving lines repeat for as long as the page is open, so anyone can stop them (WCAG 2.2.2). */
function MotionToggle() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-still', still);
  }, [still]);
  return (
    <button
      type="button"
      aria-pressed={still}
      onClick={() => setStill((value) => !value)}
      className="uppercase underline underline-offset-4 hover:text-ivory"
    >
      {still ? 'Resume motion' : 'Pause motion'}
    </button>
  );
}

export function Hero() {
  return (
    <header id="top" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <DustField
        className="absolute inset-0 -z-10 h-full w-full"
        anchor="end"
        mirror
        intensity={0.2}
      />
      {/* Reading text never sits on dust: the void closes in from the left and from below. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,#000_30%,transparent_58%),linear-gradient(90deg,#000_44%,transparent_80%)] max-md:bg-black/90"
      />
      <Nav />

      <div className={`${gutter} flex flex-1 flex-col justify-center pb-8 pt-[3vh]`}>
        <div className="max-w-[64rem] py-4">
          <h1 className="display surface text-[clamp(2.6rem,5.9vw,5.5rem)] text-ivory">
            <span className="block">Your vendor can quit.</span>
            <span className="block text-ash">Your workspace won't.</span>
          </h1>
          <p className="prose-ash surface mt-7" style={{ '--order': 1 } as CSSProperties}>
            Packout keeps a team's history and its right to write outside any single vendor. When
            the app you rely on goes away, open the export somewhere else, check every change
            against Portaldot, and keep working in the same workspace. The old vendor stays locked
            out.
          </p>
          <div
            className="surface mt-10 flex flex-wrap items-center gap-x-8 gap-y-5"
            style={{ '--order': 2 } as CSSProperties}
          >
            <a href={links.vendor} className="signal text-[13px]">
              Run the exit
              <span aria-hidden="true">→</span>
            </a>
            <a href={links.restore} className="ghost-link text-[13px]">
              Open Packout Restore
            </a>
          </div>
        </div>
      </div>

      <section aria-label="The demo run, as Portaldot recorded it" className="pb-8">
        <div className="space-y-4 overflow-hidden text-[clamp(0.6875rem,0.9vw,0.875rem)]">
          {rearPlanes.map((plane) => (
            <div key={plane.depth} aria-hidden="true" className={`baseline ${plane.depth}`}>
              <div className="drift" style={{ '--drift': plane.rate } as CSSProperties}>
                <span className="pr-[0.5em]">{plane.text.repeat(4)}</span>
                <span className="pr-[0.5em]">{plane.text.repeat(4)}</span>
              </div>
            </div>
          ))}
          <ol className={`${gutter} space-y-4`}>
            <li className="sr-only">
              Operations 0, 1 and 2 were written through Vendor A and anchored in block{' '}
              {demoRun.vendorAppend}. The vendor was stopped. The owner signed rotateEpoch in block{' '}
              {demoRun.takeover}.
            </li>
            <li className="baseline depth-0 flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-normal">
              <span>#3 · written from Packout Restore · same workspace</span>
              <BlockLink height={demoRun.ownerAppend} />
              <span className="caret" aria-hidden="true" />
            </li>
            <li className="baseline flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-normal tracking-[0.12em]">
              <span className="reversed">Vendor A writes again → refused · NotWriter</span>
              <BlockLink height={demoRun.refusal} className="text-ash" />
            </li>
          </ol>
        </div>
        <p
          className={`${gutter} baseline mt-6 text-[11px] tracking-[0.08em] text-smoke whitespace-normal`}
        >
          Recorded on Portaldot testnet, 29 Oct 2026 · workspace{' '}
          <a href={block(demoRun.vendorAppend)} className="underline underline-offset-4">
            {short(DEMO_WORKSPACE)}
          </a>{' '}
          · <MotionToggle />
        </p>
      </section>
    </header>
  );
}
