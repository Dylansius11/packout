import { type CSSProperties, createContext, useContext, useEffect, useState } from 'react';

/** What a slide knows about itself: is it on screen, and should it hold still. */
export interface SlideState {
  active: boolean;
  still: boolean;
}

export const SlideContext = createContext<SlideState>({ active: true, still: true });
export const useSlide = () => useContext(SlideContext);

/** `--i` drives every staggered reveal: the item's position in the slide's story. */
export const step = (index: number): CSSProperties => ({ '--i': index }) as CSSProperties;

const REDUCED = '(prefers-reduced-motion: reduce)';

const readStill = () =>
  window.matchMedia(REDUCED).matches || document.documentElement.hasAttribute('data-still');

/**
 * True when motion must not play: the OS asks for reduced motion, or the landing's
 * "Pause motion" control (or the deck's own) set `data-still` on <html>.
 */
export function useStill(): boolean {
  const [still, setStill] = useState(readStill);

  useEffect(() => {
    const query = window.matchMedia(REDUCED);
    const update = () => setStill(readStill());
    query.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-still'],
    });
    update();
    return () => {
      query.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return still;
}

/** True while `on`, and for `ms` after it turns off, so an exit transition can finish. */
export function useLinger(on: boolean, ms: number): boolean {
  const [lingering, setLingering] = useState(on);

  useEffect(() => {
    if (on) {
      setLingering(true);
      return;
    }
    const timer = window.setTimeout(() => setLingering(false), ms);
    return () => window.clearTimeout(timer);
  }, [on, ms]);

  return on || lingering;
}
