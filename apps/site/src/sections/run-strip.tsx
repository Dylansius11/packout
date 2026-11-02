import { type CSSProperties, useEffect, useState } from 'react';
import { block, DEMO_WORKSPACE, demoRun, short } from '../content';
import { BlockLink, gutter } from '../ui';

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
      className="inline-flex min-h-11 items-center uppercase underline underline-offset-4 transition-colors duration-150 hover:text-ivory"
    >
      {still ? 'Resume motion' : 'Pause motion'}
    </button>
  );
}

/** The demo run as Portaldot recorded it: the last two lines are the two that matter. */
export function RunStrip() {
  return (
    <section
      aria-label="The demo run, as Portaldot recorded it"
      className="border-y border-hair py-8"
    >
      <div className="space-y-4 overflow-hidden text-[clamp(0.6875rem,0.9vw,0.875rem)]">
        {rearPlanes.map((plane) => (
          <div key={plane.depth} aria-hidden="true" className={`baseline ${plane.depth}`}>
            <div className="drift" style={{ '--drift': plane.rate } as CSSProperties}>
              <span className="pr-[0.5em]">{plane.text.repeat(4)}</span>
              <span className="pr-[0.5em]">{plane.text.repeat(4)}</span>
            </div>
          </div>
        ))}
        <ol className={`${gutter} mx-auto max-w-[84rem] space-y-4`}>
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
            <BlockLink height={demoRun.refusal} className="text-mist" />
          </li>
        </ol>
      </div>
      <p
        className={`${gutter} baseline mx-auto mt-4 max-w-[84rem] whitespace-normal text-[11px] tracking-[0.08em] text-ash`}
      >
        Recorded on Portaldot testnet, 29 Oct 2026 · workspace{' '}
        <a href={block(demoRun.vendorAppend)} className="underline underline-offset-4">
          {short(DEMO_WORKSPACE)}
        </a>{' '}
        · <MotionToggle />
      </p>
    </section>
  );
}
