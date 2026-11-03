import { Wordmark } from '@packout/brand';
import { useEffect, useState } from 'react';
import { ChevronIcon } from '../components/icons';
import { SLIDE_COUNT, slideTitles } from './content';

const pad = (slide: number) => String(slide).padStart(2, '0');

/** Moving aurora loops for as long as the slide is open, so anyone can stop it (WCAG 2.2.2). */
function MotionToggle() {
  const [paused, setPaused] = useState(() => document.documentElement.hasAttribute('data-still'));
  useEffect(() => {
    document.documentElement.toggleAttribute('data-still', paused);
  }, [paused]);
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setPaused((value) => !value)}
      className="baseline d-bar-btn d-bar-motion"
    >
      {paused ? 'Resume motion' : 'Pause motion'}
    </button>
  );
}

/** Slim top bar: the wordmark back to the site, the counter, motion control, Close. */
export function TopBar({ slide }: { slide: number }) {
  return (
    <header className="d-bar">
      <div className="d-wrap d-bar-in">
        <a href="/" aria-label="Packout, back to the site" className="d-brand">
          <Wordmark size={15} drifting />
        </a>
        <p className="baseline d-counter">
          <span className="d-vh">{`Slide ${slide} of ${SLIDE_COUNT}`}</span>
          <span aria-hidden="true">
            {pad(slide)} <span className="d-counter-of">/ {SLIDE_COUNT}</span>
          </span>
        </p>
        <div className="d-bar-end">
          <MotionToggle />
          <a href="/" className="baseline d-bar-btn d-bar-close">
            Close
          </a>
        </div>
      </div>
    </header>
  );
}

/** Bottom rail: previous, twelve segments that jump, next. */
export function Rail({ slide, go }: { slide: number; go: (slide: number) => void }) {
  const first = slide === 1;
  const last = slide === SLIDE_COUNT;
  return (
    <nav aria-label="Slides" className="d-rail">
      <div className="d-wrap d-rail-in">
        <button
          type="button"
          aria-label="Previous slide"
          aria-disabled={first}
          onClick={() => !first && go(slide - 1)}
          className="d-step-btn"
        >
          <ChevronIcon direction="left" className="size-5" />
        </button>
        <ol className="d-segs">
          {slideTitles.map((title, index) => {
            const number = index + 1;
            return (
              <li key={title}>
                <button
                  type="button"
                  aria-label={`Slide ${number}: ${title}`}
                  aria-current={number === slide ? 'step' : undefined}
                  data-state={number < slide ? 'done' : number === slide ? 'now' : 'next'}
                  onClick={() => go(number)}
                  className="d-seg"
                >
                  <span aria-hidden="true" className="d-seg-bar" />
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          aria-label="Next slide"
          aria-disabled={last}
          onClick={() => !last && go(slide + 1)}
          className="d-step-btn"
        >
          <ChevronIcon direction="right" className="size-5" />
        </button>
      </div>
    </nav>
  );
}
