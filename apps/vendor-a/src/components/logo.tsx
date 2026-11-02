/** A bookmark ribbon with two lines of text: the journal, kept. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 23V10a7 7 0 0 1 14 0v13l-7-4.5z" className="fill-primary" />
      <path
        d="M9 9.5h6M9 13h3.5"
        className="stroke-surface"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-7" />
      <span className="flex items-baseline gap-2.5">
        <span className="display text-[1.4rem] font-semibold leading-none">Vendor A</span>
        <span className="hidden text-[13px] text-muted-foreground sm:inline">Issue journal</span>
      </span>
    </span>
  );
}
