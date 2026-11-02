import { DustField, PixelMark } from '@packout/brand';
import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { links } from '../content';
import { gutter } from '../ui';

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
    <Section
      n="10"
      label="Boundaries"
      headingId="boundaries-heading"
      heading="What Packout isn’t."
      tone="panel"
    >
      <Pull className="mt-8">
        Small, <mark>honest boundaries</mark> beat big promises.
      </Pull>
      <ul className="mt-12 grid gap-4 md:grid-cols-2">
        {nots.map(([claim, why], index) => (
          <Reveal key={claim} as="li" delay={index * 60} className="card p-6 md:p-8">
            <p className="baseline whitespace-normal text-[14px] text-ivory">{claim}</p>
            <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-mist">{why}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export function Close() {
  return (
    <section
      aria-labelledby="close-heading"
      className="relative isolate overflow-hidden py-[clamp(7rem,16vw,12rem)]"
    >
      <div aria-hidden="true" className="glow-still absolute inset-0 -z-20" />
      <DustField
        className="absolute inset-0 -z-10 h-full w-full"
        anchor="end"
        mirror
        intensity={0.2}
      />
      <div className={`${gutter} mx-auto max-w-[84rem]`}>
        <Reveal className="flex flex-col items-start gap-10">
          <PixelMark size="clamp(4rem, 9vw, 7.5rem)" drifting className="text-ivory" />
          <h2 id="close-heading" className="display text-[clamp(2.6rem,7vw,6rem)] text-ivory">
            Leave on your <span className="text-signal">own terms.</span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <a href={links.vendor} className="pill px-6">
              Run the exit
              <span aria-hidden="true">→</span>
            </a>
            <a href={links.code} className="ghost-link text-[13px]">
              Read the code
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
