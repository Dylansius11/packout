import type { CSSProperties, ReactNode } from 'react';

/** The top of a screen: one display line that takes focus, readable at once, then its context. */
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="display text-[clamp(2.25rem,5.2vw,4.5rem)] text-ivory">{title}</h1>
      {children ? (
        <div className="prose-ash surface mt-6" style={{ '--order': 1 } as CSSProperties}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
