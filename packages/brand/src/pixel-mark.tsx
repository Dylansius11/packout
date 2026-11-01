import type { CSSProperties } from 'react';
import { MARK_HEIGHT, MARK_RECTS, MARK_WIDTH } from './mark-geometry.ts';

// The loose pixels on the right of the figure: the part of the pack already on its way out.
const isTrail = ([x, , w]: readonly [number, number, number, number]) => x >= 108 && w <= 10;
const BODY = MARK_RECTS.filter((rect) => !isTrail(rect));
const TRAIL = MARK_RECTS.filter(isTrail);
const BODY_PATH = BODY.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join('');

export interface PixelMarkProps {
  /** Rendered height in CSS pixels or any CSS length. Width follows the mark's ratio. */
  size?: number | string;
  /** Let the trailing pixels drift. Ignored under prefers-reduced-motion (see tokens). */
  drifting?: boolean;
  /** Accessible name. Omit when the mark sits next to the word "Packout". */
  label?: string;
  className?: string;
}

export function PixelMark({ size = 24, drifting = false, label, className }: PixelMarkProps) {
  const height = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      style={{ height, width: 'auto' }}
      className={className}
      shapeRendering="crispEdges"
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-drifting={drifting || undefined}
    >
      <path d={BODY_PATH} />
      {TRAIL.map(([x, y, w, h], index) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          className="packout-trail"
          style={{ '--trail-index': index } as CSSProperties}
        />
      ))}
    </svg>
  );
}

export interface WordmarkProps {
  /** Cap height of "Packout" in px; the mark and the ™ scale from it. */
  size?: number;
  drifting?: boolean;
  className?: string;
}

/** The lockup from the founder's artwork: figure, "Packout", ™. */
export function Wordmark({ size = 18, drifting = false, className }: WordmarkProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${size * 0.42}px`,
        lineHeight: 1,
      }}
    >
      <PixelMark size={size * 1.32} drifting={drifting} />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: `${size * 1.38}px`,
          fontWeight: 520,
          letterSpacing: '-0.025em',
        }}
      >
        Packout
        <sup style={{ fontSize: '0.4em', fontWeight: 500, marginLeft: '0.06em', top: '-1em' }}>
          ™
        </sup>
      </span>
    </span>
  );
}
