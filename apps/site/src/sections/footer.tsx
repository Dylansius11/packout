import { Wordmark } from '@packout/brand';
import { DemoLinks, GithubLink, gutter } from '../ui';

/** The name returns large; the demo links, the source and one honest line of status. */
export function Footer() {
  return (
    <footer className={`${gutter} border-t border-hair pb-10 pt-14 md:pt-20`}>
      <div className="mx-auto max-w-[84rem]">
        <div className="md:hidden">
          <Wordmark size={44} className="text-ivory" />
        </div>
        <div aria-hidden="true" className="hidden md:block">
          <Wordmark size={92} drifting className="text-ivory" />
        </div>
        <div className="mt-12 md:mt-16">
          <DemoLinks />
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-hair pt-6 md:flex-row md:items-center md:justify-between">
          <GithubLink label="Source on GitHub" />
          <p className="baseline whitespace-normal text-[11px] text-ash">
            Portaldot testnet only · built for Portaldot Hacker House 2026 · Modular Cloud and
            Middleware
          </p>
        </div>
      </div>
    </footer>
  );
}
