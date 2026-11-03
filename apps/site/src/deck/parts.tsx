import type { CSSProperties, ReactNode } from 'react';
import { type HeadlineLine, srcLabel } from './content';
import { step } from './motion';

/**
 * A headline with one lit phrase in the bitmap face and amber. The copy stays whole in
 * content.ts; the slide only says which phrase of it to light.
 */
export function Headline({
  text,
  accent,
  as: Tag = 'h2',
  className = '',
  order = 1,
}: {
  text: string;
  accent: string;
  as?: 'h1' | 'h2';
  className?: string;
  order?: number;
}) {
  const at = text.indexOf(accent);
  if (at < 0) throw new Error(`Headline accent "${accent}" is not part of "${text}".`);
  return (
    <Tag className={`d-h rv ${className}`} style={step(order)}>
      {text.slice(0, at)}
      <span className="d-accent">{accent}</span>
      {text.slice(at + accent.length)}
    </Tag>
  );
}

export function Eyebrow({ children, order = 0 }: { children: string; order?: number }) {
  return (
    <p className="eyebrow d-eyebrow rv" style={step(order)}>
      {children}
    </p>
  );
}

/** A small footer source link: real anchor, opens in a new tab, readable contrast. */
export function Src({ href, label = srcLabel(href) }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="d-src">
      <span aria-hidden="true">↗ </span>
      Source: {label}
      <span className="d-vh"> (opens in a new tab)</span>
    </a>
  );
}

/** The lines of a bitmap headline, one block each, swept in one after another. */
export function SweepLines({
  lines,
  className = '',
  stepMs = 1100,
}: {
  lines: readonly HeadlineLine[];
  className?: string;
  /** Duration of one line's sweep, in ms. */
  stepMs?: number;
}) {
  return (
    <>
      {lines.map((line, index) => {
        const chars = line.text.length + (line.accent?.length ?? 0);
        const style = {
          '--line': index,
          '--chars': chars,
          '--sweep': `${stepMs}ms`,
        } as CSSProperties;
        return (
          <span key={line.text + (line.accent ?? '')} className={`d-sweep ${className}`}>
            <span className="d-sweep-in" style={style}>
              {line.text}
              {line.accent ? <span className="d-lit">{line.accent}</span> : null}
            </span>
          </span>
        );
      })}
    </>
  );
}

/**
 * Every slide's skeleton: an optional backdrop that never scrolls, then a scroller holding the
 * body. On phones the scroller carries the whole slide; the bars stay fixed above and below.
 */
export function Frame({
  backdrop,
  className = '',
  children,
}: {
  backdrop?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      {backdrop}
      <div className="d-scroll">
        <div className={`d-body d-wrap ${className}`}>{children}</div>
      </div>
    </>
  );
}

/** The sentence of a slide that matters, with its key phrase lit like the landing's pull-statement. */
export function Pull({
  text,
  mark,
  order,
  className = '',
}: {
  text: string;
  mark: string;
  order: number;
  className?: string;
}) {
  const at = text.indexOf(mark);
  if (at < 0) throw new Error(`Pull mark "${mark}" is not part of "${text}".`);
  return (
    <p className={`pull d-pull rv ${className}`} style={step(order)}>
      {text.slice(0, at)}
      <mark>{mark}</mark>
      {text.slice(at + mark.length)}
    </p>
  );
}
