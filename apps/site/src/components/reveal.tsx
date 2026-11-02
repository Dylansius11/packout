import { type CSSProperties, type ElementType, type ReactNode, useEffect, useRef } from 'react';

/**
 * Fades and lifts its children into place once, the first time they scroll into view.
 * Blocks already above the viewport (anchor jumps) are revealed immediately. Without script
 * nothing is hidden: the hidden state only exists under `html.js` (see styles.css).
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className = '',
  children,
}: {
  as?: ElementType;
  /** Stagger, in milliseconds. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      node.dataset.in = '';
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          node.dataset.in = '';
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
