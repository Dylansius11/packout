import { type ComponentType, useEffect, useRef } from 'react';
import { Rail, TopBar } from './chrome';
import { SLIDE_COUNT, slideTitles } from './content';
import { SlideContext, useStill } from './motion';
import { ArchitectureSlide } from './slides/architecture';
import { AudienceSlide } from './slides/audience';
import { BusinessSlide } from './slides/business';
import { CloseSlide } from './slides/close';
import { ComparisonSlide } from './slides/comparison';
import { MarketSlide } from './slides/market';
import { OpeningSlide } from './slides/opening';
import { PortaldotSlide } from './slides/portaldot';
import { ProblemSlide } from './slides/problem';
import { ProofSlide } from './slides/proof';
import { SolutionSlide } from './slides/solution';
import { TeamSlide } from './slides/team';
import { useDeck } from './use-deck';
import './deck.css';

const slides: ComponentType[] = [
  OpeningSlide,
  ProblemSlide,
  AudienceSlide,
  SolutionSlide,
  ProofSlide,
  PortaldotSlide,
  ArchitectureSlide,
  MarketSlide,
  BusinessSlide,
  ComparisonSlide,
  TeamSlide,
  CloseSlide,
];

/** One slide's frame. Away from the current slide it waits on the side it would come from. */
function SlideFrame({
  number,
  current,
  still,
}: {
  number: number;
  current: number;
  still: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const active = number === current;
  const Slide = slides[number - 1];

  // Coming back to a slide starts it from the top, like the first visit.
  useEffect(() => {
    if (!active) return;
    for (const scroller of ref.current?.querySelectorAll('.d-scroll') ?? []) scroller.scrollTop = 0;
  }, [active]);

  return (
    <section
      ref={ref}
      aria-label={`Slide ${number} of ${SLIDE_COUNT}: ${slideTitles[number - 1]}`}
      className="d-slide"
      data-state={active ? 'active' : number < current ? 'before' : 'after'}
      inert={!active}
      aria-hidden={!active}
    >
      <SlideContext.Provider value={{ active, still }}>
        <Slide />
      </SlideContext.Provider>
    </section>
  );
}

/** The pitch deck: twelve slides, hash routed (#1 to #12), keyboard and swipe driven. */
export function Deck() {
  const { slide, go, notice } = useDeck();
  const still = useStill();

  useEffect(() => {
    document.title = `Packout pitch deck · ${slide} / ${SLIDE_COUNT}`;
  }, [slide]);

  return (
    <div className="deck" data-motion={still ? undefined : ''}>
      <TopBar slide={slide} />
      <main className="d-stage" id="deck">
        {slideTitles.map((title, index) => (
          <SlideFrame key={title} number={index + 1} current={slide} still={still} />
        ))}
      </main>
      <Rail slide={slide} go={go} />
      <p role="status" aria-live="polite" className="d-vh">
        {`Slide ${slide} of ${SLIDE_COUNT}: ${slideTitles[slide - 1]}. ${notice}`}
      </p>
    </div>
  );
}
