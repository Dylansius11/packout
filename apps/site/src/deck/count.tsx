import { useLayoutEffect, useState } from 'react';
import { useSlide } from './motion';

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * A numeral that counts up each time its slide comes on screen. Assistive tech reads only the
 * final value; the animated digits are hidden from it. Held at the final value when motion is
 * off, and while the slide is away, so the exit transition never shows a half-counted number.
 */
export function Count({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  tail = '',
  duration = 1500,
  delay = 350,
  className = '',
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Plain text after the numeral that is not part of the count, e.g. " ARR". */
  tail?: string;
  duration?: number;
  /** Milliseconds after the slide arrives before counting starts. */
  delay?: number;
  className?: string;
}) {
  const { active, still } = useSlide();
  const [value, setValue] = useState(to);

  useLayoutEffect(() => {
    if (!active || still) {
      setValue(to);
      return;
    }
    setValue(0);
    let frame = 0;
    let started = 0;
    const tick = (now: number) => {
      started ||= now;
      const progress = Math.min(1, (now - started) / duration);
      setValue(to * easeOutExpo(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [active, still, to, duration, delay]);

  const final = `${prefix}${to.toFixed(decimals)}${suffix}`;
  return (
    <span className={`d-count ${className}`}>
      <span className="d-vh">{`${final}${tail}`}</span>
      {/* The final text reserves the width so the row does not shift while digits count. */}
      <span aria-hidden="true" className="d-count-size">
        {final}
      </span>
      <span aria-hidden="true" className="d-count-live">
        {`${prefix}${value.toFixed(decimals)}${suffix}`}
      </span>
      {tail ? (
        <span aria-hidden="true" className="d-count-tail">
          {tail}
        </span>
      ) : null}
    </span>
  );
}
