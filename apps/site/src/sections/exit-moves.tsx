import { useEffect, useRef, useState } from 'react';
import { moves } from '../content';
import { DemoLinks, gutter, SectionHeading } from '../ui';

/**
 * The seven moves of the demo. Scrolling pulls one move to the front plane; the board on the
 * left reports the state of the vendor and the workspace at that moment.
 */
export function ExitMoves() {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.move));
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const item of items.current) if (item) observer.observe(item);
    return () => observer.disconnect();
  }, []);

  const current = moves[active];
  return (
    <section
      id="exit"
      aria-labelledby="exit-heading"
      className={`${gutter} scroll-mt-8 py-[clamp(5rem,10vw,8rem)]`}
    >
      <SectionHeading id="exit-heading">The exit, start to finish.</SectionHeading>
      <p className="prose-ash mt-6">
        This is the run we do live. Nothing here is mocked: the vendor process really stops, and the
        refusal at the end is a mined transaction.
      </p>
      <div className="mt-8">
        <DemoLinks />
      </div>

      <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-24">
        <div className="hidden lg:block">
          <div className="sticky top-[30vh]" aria-live="polite">
            <p className="baseline depth-2 text-[12px]">
              Move {active + 1} of {moves.length}
            </p>
            <dl className="mt-8 space-y-6 text-[13px]">
              <div>
                <dt className="baseline depth-2">Vendor A</dt>
                <dd
                  className={`baseline mt-2 inline-block ${active === moves.length - 1 ? 'reversed' : 'depth-0'}`}
                >
                  {current.vendor}
                </dd>
              </div>
              <div>
                <dt className="baseline depth-2">Workspace</dt>
                <dd className="baseline depth-0 mt-2">{current.workspace}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ol className="space-y-[clamp(2.5rem,6vh,4.5rem)]">
          {moves.map((move, index) => {
            const state = index === active ? 'front' : index < active ? 'past' : 'ahead';
            return (
              <li
                key={move.title}
                ref={(node) => {
                  items.current[index] = node;
                }}
                data-move={index}
                className="grid grid-cols-[3.5rem_1fr] gap-x-4 lg:min-h-[26vh]"
              >
                <span
                  className={`baseline pt-2 text-[13px] transition-colors duration-300 ${state === 'front' ? 'text-signal' : 'text-smoke'}`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3
                    className={`display text-[clamp(1.6rem,3vw,2.5rem)] transition-[color,letter-spacing] duration-500 ease-[var(--ease-out)] ${
                      state === 'front'
                        ? 'tracking-[0.04em] text-ivory'
                        : state === 'past'
                          ? 'text-ash'
                          : 'text-smoke'
                    }`}
                  >
                    {move.title}
                    {state === 'front' ? <span className="caret" aria-hidden="true" /> : null}
                  </h3>
                  <p
                    className={`mt-4 max-w-[52ch] text-[17px] leading-relaxed transition-colors duration-500 ${state === 'ahead' ? 'text-smoke' : 'text-ash'}`}
                  >
                    {move.body}
                  </p>
                  <p className="baseline depth-2 mt-5 text-[11px] whitespace-normal lg:hidden">
                    Vendor A: {move.vendor} · workspace: {move.workspace}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
