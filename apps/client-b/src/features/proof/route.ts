import { useSyncExternalStore } from 'react';

const PREFIX = '#/proof/';

/** Where the public proof page for a workspace lives. Hash routes keep it working on any static host. */
export function proofHref(wsId: string): string {
  return `${PREFIX}${wsId}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/**
 * The workspace id text of the proof route in the address bar, or null on any other hash.
 * The text is unvalidated: a mistyped id still gets the proof page, which says what is wrong.
 */
export function useProofRoute(): string | null {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  if (!hash.startsWith(PREFIX)) return null;
  const text = hash.slice(PREFIX.length);
  try {
    return decodeURIComponent(text).trim();
  } catch {
    return text;
  }
}
