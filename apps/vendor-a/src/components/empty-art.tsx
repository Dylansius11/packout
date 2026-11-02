/** An open journal with its ribbon and a pencil: nothing written yet. Decorative. */
export function EmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 116" fill="none" className={className} aria-hidden="true">
      <ellipse cx="84" cy="104" rx="64" ry="5" className="fill-muted" />
      <path
        d="M20 30c20-7 40-4 64 8v60C60 86 40 83 20 90z"
        className="fill-surface stroke-foreground"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M148 30c-20-7-40-4-64 8v60c24-12 44-15 64-8z"
        className="fill-surface stroke-foreground"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 44c12-3 24-2 38 4M32 56c12-3 24-2 38 4M32 68c12-3 24-2 38 4"
        className="stroke-border-strong"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M98 48c14-6 26-7 38-4M98 60c14-6 26-7 38-4"
        className="stroke-border-strong"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M100 38v36l7-5 7 5V41z" className="fill-primary" />
      <g transform="rotate(38 128 84)">
        <rect
          x="122"
          y="60"
          width="9"
          height="42"
          rx="1.5"
          className="fill-surface stroke-foreground"
          strokeWidth="1.5"
        />
        <path d="M122 102h9l-4.5 9z" className="fill-foreground" />
        <path d="M122 68h9" className="stroke-foreground" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
