import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { ChevronIcon } from '../components/icons';
import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { moves } from '../content';
import { DemoLinks } from '../ui';

/**
 * The seven moves of the demo as a step-through. One move is open at a time; the active step
 * is lit in the accent. Tabs: arrows, Home and End move between steps; Previous and Next do too.
 */
export function ExitMoves() {
  const base = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const last = moves.length - 1;
  const current = moves[active];
  const final = active === last;

  function go(index: number, focus = false) {
    setActive(index);
    if (focus) tabs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = active;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(active + 1, last);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(active - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    go(next, true);
  }

  return (
    <Section
      id="exit"
      n="02"
      label="How it works"
      headingId="exit-heading"
      heading="The exit, start to finish."
      tone="panel"
    >
      <Pull className="mt-8">
        Nothing here is mocked: the vendor process really stops, and the refusal at the end is a{' '}
        <mark>mined transaction</mark>.
      </Pull>
      <Reveal delay={100} className="mt-8">
        <p className="prose">This is the run we do live.</p>
        <div className="mt-5">
          <DemoLinks />
        </div>
      </Reveal>

      <Reveal delay={140} className="mt-12 md:mt-16">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-10">
          <div
            role="tablist"
            aria-label="The seven moves of the exit"
            onKeyDown={onKeyDown}
            className="flex gap-0.5 lg:flex-col lg:gap-1"
          >
            {moves.map((move, index) => {
              const selected = index === active;
              const passed = index < active;
              return (
                <button
                  key={move.title}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`${base}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => go(index)}
                  className={`group flex min-h-11 flex-1 items-center justify-center gap-3 rounded-xl px-2 text-left transition-[background-color,color] duration-200 active:scale-[0.98] lg:flex-none lg:justify-start lg:px-4 ${
                    selected
                      ? 'bg-signal/[0.13] text-ivory'
                      : 'text-mist hover:bg-white/[0.05] hover:text-ivory'
                  }`}
                >
                  <span
                    className={`baseline text-[13px] ${selected ? 'text-signal' : passed ? 'text-ivory' : 'text-ash'}`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`hidden text-[16px] leading-tight lg:block ${selected ? 'font-semibold' : ''}`}
                  >
                    {move.title}
                  </span>
                  <span className="sr-only lg:hidden">{move.title}</span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`${base}-panel`}
            aria-labelledby={`${base}-tab-${active}`}
            aria-live="polite"
            className="card flex min-h-[26rem] flex-col p-6 md:p-10"
          >
            <div key={active} className="swap flex flex-1 flex-col">
              <p className="numeral text-[clamp(2.5rem,5vw,4rem)]">
                {String(active + 1).padStart(2, '0')}
              </p>
              <h3 className="display mt-5 text-[clamp(1.75rem,3vw,2.5rem)] text-ivory">
                {current.title}
              </h3>
              <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-mist">
                {current.body}
              </p>
              <dl className="mt-auto grid gap-4 pt-10 sm:grid-cols-2">
                <div className="rounded-xl border border-hair bg-black/40 p-4">
                  <dt className="baseline depth-1 text-[11px]">Vendor A</dt>
                  <dd
                    className={`baseline mt-2 inline-block text-[14px] ${final ? 'reversed' : 'text-ivory'}`}
                  >
                    {current.vendor}
                  </dd>
                </div>
                <div className="rounded-xl border border-signal/35 bg-signal/[0.06] p-4">
                  <dt className="baseline depth-1 text-[11px]">Workspace</dt>
                  <dd className="baseline mt-2 text-[14px] text-ivory">{current.workspace}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hair pt-5">
              <p className="baseline depth-1 text-[11px]">
                Move {active + 1} of {moves.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="pill px-4"
                  aria-disabled={active === 0}
                  onClick={() => active > 0 && go(active - 1)}
                >
                  <ChevronIcon direction="left" />
                  Previous
                </button>
                <button
                  type="button"
                  className="pill px-4"
                  aria-disabled={final}
                  onClick={() => !final && go(active + 1)}
                >
                  Next
                  <ChevronIcon direction="right" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
