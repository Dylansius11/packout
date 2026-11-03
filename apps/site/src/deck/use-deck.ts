import { useCallback, useEffect, useState } from 'react';
import { SLIDE_COUNT } from './content';

const clamp = (slide: number) => Math.min(SLIDE_COUNT, Math.max(1, slide));

/** The URL hash is the single source of truth: `#6` is slide 6. Anything else is slide 1. */
function readHash(): number {
  const slide = Number.parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(slide) ? clamp(slide) : 1;
}

/** True when a key press belongs to a control the user is operating, not to the deck. */
function isOperatingControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

const SWIPE_DISTANCE = 56;

export interface Deck {
  /** Current slide, 1 to SLIDE_COUNT. */
  slide: number;
  go: (slide: number) => void;
  /** Set when a request could not be honoured, for the live region. */
  notice: string;
}

/** Hash routing, the keyboard map and horizontal swipe. */
export function useDeck(): Deck {
  const [slide, setSlide] = useState(readHash);
  const [notice, setNotice] = useState('');

  const go = useCallback((target: number) => {
    const next = clamp(target);
    if (window.location.hash !== `#${next}`) window.location.hash = String(next);
  }, []);

  // Normalise a bare /deck to #1 without adding a history entry.
  useEffect(() => {
    const onHash = () => setSlide(readHash());
    if (window.location.hash !== `#${readHash()}`) {
      window.history.replaceState(null, '', `#${readHash()}`);
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const toggleFullscreen = () => {
      const request = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      request.then(
        () => setNotice(''),
        () => setNotice('Full screen is not available in this browser.'),
      );
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isOperatingControl(event.target))
        return;
      const onButton =
        event.target instanceof Element && event.target.closest('button, a, summary') !== null;
      const key = event.key;
      let next: number | null = null;
      if (key === 'ArrowRight' || key === 'PageDown') next = slide + 1;
      else if (key === 'ArrowLeft' || key === 'PageUp') next = slide - 1;
      else if (key === ' ' && !onButton) next = slide + (event.shiftKey ? -1 : 1);
      else if (key === 'Home') next = 1;
      else if (key === 'End') next = SLIDE_COUNT;
      else if (/^[1-9]$/.test(key)) next = Number(key);
      else if (key === 'f' || key === 'F') {
        event.preventDefault();
        toggleFullscreen();
        return;
      }
      if (next === null) return;
      event.preventDefault();
      go(next);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slide, go]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (event: TouchEvent) => {
      tracking = event.touches.length === 1;
      startX = event.touches[0]?.clientX ?? 0;
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // A mostly horizontal drag is a swipe; a vertical one scrolls the slide.
      if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      go(slide + (dx < 0 ? 1 : -1));
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [slide, go]);

  return { slide, go, notice };
}
