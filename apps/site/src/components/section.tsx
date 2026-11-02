import type { ReactNode } from 'react';
import { gutter } from '../ui';
import { Reveal } from './reveal';

/**
 * Every section opens the same way: a numbered eyebrow, then its heading. Sections alternate
 * between the plain void and a lifted highlight panel, so each one has a clear start and end.
 */
export function Section({
  id,
  n,
  label,
  headingId,
  heading,
  tone = 'void',
  children,
}: {
  id?: string;
  n: string;
  label: string;
  headingId: string;
  heading: ReactNode;
  tone?: 'void' | 'panel';
  children: ReactNode;
}) {
  const panel = tone === 'panel';
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`${gutter} scroll-mt-20 ${panel ? 'py-[clamp(0.75rem,2vw,2rem)]' : 'py-[clamp(4.5rem,9vw,8rem)]'}`}
    >
      <div className="mx-auto max-w-[110rem]">
        <div className={panel ? 'panel' : undefined}>
          <Reveal>
            <p className="eyebrow">
              <span>{n}</span>
              <span aria-hidden="true">/</span>
              <span>{label}</span>
            </p>
            <h2
              id={headingId}
              className="display mt-5 max-w-[20ch] text-[clamp(2rem,4.4vw,3.75rem)] text-ivory"
            >
              {heading}
            </h2>
          </Reveal>
          {children}
        </div>
      </div>
    </section>
  );
}

/** The one sentence of a section that matters. Wrap the key phrase in `<mark>`. */
export function Pull({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Reveal delay={60} className={className}>
      <p className="pull">{children}</p>
    </Reveal>
  );
}
