import { block, links } from './content';

/** Horizontal rhythm shared by every section: one gutter, one measure. */
export const gutter = 'px-[clamp(1.25rem,5vw,4.5rem)]';

/** The standard GitHub mark, 16px grid. */
function GithubMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className={`${className} shrink-0`}
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * The GitHub link. `pill` is the header's secondary button (mark plus "GitHub" from 640px);
 * with `label` it is a text link; alone it is a 44px icon target.
 */
export function GithubLink({
  label,
  pill = false,
  className = '',
}: {
  label?: string;
  pill?: boolean;
  className?: string;
}) {
  if (pill) {
    return (
      <a
        href={links.code}
        aria-label="View source on GitHub"
        className={`pill max-sm:min-w-11 max-sm:px-0 ${className}`}
      >
        <GithubMark className="size-[18px]" />
        <span className="max-sm:hidden">GitHub</span>
      </a>
    );
  }
  return (
    <a
      href={links.code}
      aria-label="View source on GitHub"
      className={`inline-flex min-h-11 items-center gap-3 text-mist transition-colors duration-150 hover:text-ivory ${label ? '' : 'min-w-11 justify-center'} ${className}`}
    >
      <GithubMark />
      {label ? <span className="baseline text-[12px] tracking-[0.12em]">{label}</span> : null}
    </a>
  );
}

/**
 * Two secondary links that say what each demo app is: Vendor A is a separate company's product,
 * Packout Restore is the independent Packout app.
 */
export function DemoLinks() {
  return (
    <ul className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
      <li>
        <a href={links.vendor} className="ghost-link inline-flex min-h-11 items-center text-[13px]">
          Go to demo vendor
        </a>
        <p className="max-w-[36ch] text-[14px] leading-relaxed text-ash">
          Vendor A is a separate demo company app. It is not part of Packout.
        </p>
      </li>
      <li>
        <a
          href={links.restore}
          className="ghost-link inline-flex min-h-11 items-center text-[13px]"
        >
          Go to demo restore
        </a>
        <p className="max-w-[36ch] text-[14px] leading-relaxed text-ash">
          Packout Restore is the independent Packout app that opens the export.
        </p>
      </li>
    </ul>
  );
}

/** A block height as a link to the Portaldot explorer, in the voice of the baseline it sits on. */
export function BlockLink({ height, className = '' }: { height: number; className?: string }) {
  return (
    <a
      href={block(height)}
      target="_blank"
      rel="noreferrer"
      className={`baseline underline decoration-ash/50 underline-offset-[0.45em] transition-colors duration-150 hover:text-ivory hover:decoration-signal ${className}`}
    >
      block {height}
      <span className="sr-only"> on the Portaldot explorer (opens in a new tab)</span>
    </a>
  );
}
