import { DustField, PixelMark, Wordmark } from '@packout/brand';
import { links } from '../content';
import { DemoLinks, GithubLink, gutter, SectionHeading } from '../ui';

const nots = [
  ['Not a backup service.', 'For files only you use, plain encrypted storage is simpler.'],
  ['Not on mainnet.', 'Everything on this page runs on Portaldot testnet.'],
  ['Not a light client.', 'Verification trusts the RPC endpoints it names, and says so.'],
  [
    'Not magic for lost keys.',
    'Recovery restores who may write. Your data key comes back only from shares you handed out.',
  ],
];

export function Boundaries() {
  return (
    <section
      aria-labelledby="boundaries-heading"
      className={`${gutter} py-[clamp(5rem,10vw,8rem)]`}
    >
      <SectionHeading id="boundaries-heading">What Packout isn’t.</SectionHeading>
      <ul className="mt-14 grid gap-x-16 gap-y-10 md:grid-cols-2">
        {nots.map(([claim, why]) => (
          <li key={claim}>
            <p className="baseline depth-0 text-[14px] whitespace-normal">{claim}</p>
            <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ash">{why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Close() {
  return (
    <section
      aria-labelledby="close-heading"
      className="relative isolate overflow-hidden py-[clamp(7rem,16vw,12rem)]"
    >
      <DustField
        className="absolute inset-0 -z-10 h-full w-full"
        anchor="end"
        mirror
        intensity={0.2}
      />
      <div className={`${gutter} flex flex-col items-start gap-10`}>
        <PixelMark size="clamp(4rem, 9vw, 7.5rem)" drifting className="text-ivory" />
        <h2 id="close-heading" className="display text-[clamp(2.6rem,7vw,6rem)] text-ivory">
          Leave on your own terms.
        </h2>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <a href={links.vendor} className="signal text-[13px]">
            Run the exit
            <span aria-hidden="true">→</span>
          </a>
          <a href={links.code} className="ghost-link text-[13px]">
            Read the code
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={`${gutter} flex flex-col gap-10 py-12`}>
      <DemoLinks />
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Wordmark size={13} className="text-ash" />
          <GithubLink label="Source on GitHub" />
        </div>
        <p className="baseline depth-2 text-[11px] whitespace-normal">
          Built for Portaldot Hacker House 2026 · Modular Cloud and Middleware
        </p>
      </div>
    </footer>
  );
}
