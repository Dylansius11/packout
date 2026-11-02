import { Wordmark } from '@packout/brand';
import { links } from '../content';
import { GithubLink, gutter } from '../ui';

const nav = [
  { href: '#exit', label: 'How it works' },
  { href: '#record', label: 'Proof' },
  { href: '#builders', label: 'Kit' },
  { href: '#resources', label: 'Resources' },
  { href: '#build', label: 'Build' },
];

/** Sticky glass bar: wordmark, section links, a GitHub pill and the page's header action. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hair bg-black/55 backdrop-blur-xl backdrop-saturate-150">
      <nav
        aria-label="Primary"
        className={`${gutter} mx-auto flex h-16 max-w-[84rem] items-center justify-between`}
      >
        <a href="#top" aria-label="Packout, back to top" className="text-ivory">
          <Wordmark size={16} drifting />
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <ul className="mr-4 hidden items-center gap-7 xl:flex">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="baseline inline-flex min-h-11 items-center text-[12px] tracking-[0.12em] text-mist transition-colors duration-150 hover:text-ivory"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <GithubLink pill />
          <a href={links.vendor} className="signal text-[12px] max-sm:px-4">
            Run the exit
          </a>
        </div>
      </nav>
    </header>
  );
}
