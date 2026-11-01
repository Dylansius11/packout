import type { ReactNode } from 'react';
import { block } from './content';

/** Horizontal rhythm shared by every section: one gutter, one measure. */
export const gutter = 'px-[clamp(1.25rem,5vw,4.5rem)]';

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="display max-w-[18ch] text-[clamp(2rem,4.4vw,3.75rem)] text-ivory">
      {children}
    </h2>
  );
}

/** A block height as a link to the Portaldot explorer, in the voice of the baseline it sits on. */
export function BlockLink({ height, className = '' }: { height: number; className?: string }) {
  return (
    <a
      href={block(height)}
      target="_blank"
      rel="noreferrer"
      className={`baseline underline decoration-smoke underline-offset-[0.45em] transition-colors duration-150 hover:text-ivory hover:decoration-signal ${className}`}
    >
      block {height}
      <span className="sr-only"> on the Portaldot explorer (opens in a new tab)</span>
    </a>
  );
}
