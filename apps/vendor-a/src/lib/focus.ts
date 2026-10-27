import { type RefObject, useEffect, useRef } from 'react';

/**
 * Keyboard focus falls to <body> when the focused control disables or unmounts itself.
 * Puts it back on `target`, but never steals it from a control the user already moved to.
 */
export function restoreFocus(target: HTMLElement | null | undefined): void {
  const active = document.activeElement;
  if (target && (active === null || active === document.body)) target.focus();
}

/** When `busy` ends (a submit button was disabled while it ran), returns focus to `target` if it was lost. */
export function useRestoreFocusWhenIdle(
  busy: boolean,
  target: RefObject<HTMLElement | null>,
): void {
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    restoreFocus(target.current);
  }, [busy, target]);
}

/**
 * Moves focus to `root` when `key` changes, so a keyboard or screen-reader user starts at the top of
 * the new page instead of on a control that no longer exists. The first key is the page load: no move.
 */
export function useFocusOnChange(key: string, root: RefObject<HTMLElement | null>): void {
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (key === previous.current) return;
    const first = previous.current === undefined;
    previous.current = key;
    const target = root.current;
    if (first || !target) return;
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
  }, [key, root]);
}
