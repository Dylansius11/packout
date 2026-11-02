import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { stats } from '../content';

/** The stat strip: pixel numerals in the accent, each with the place its evidence lives. */
export function Numbers() {
  return (
    <Section
      id="numbers"
      n="04"
      label="By the numbers"
      headingId="numbers-heading"
      heading="Observed, not promised."
      tone="panel"
    >
      <Pull className="mt-8">
        Every row has a <mark>source in this repository</mark>.
      </Pull>
      <Reveal delay={120} className="mt-12 md:mt-16">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-hair bg-[#272725] sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <li key={stat.value} className="flex flex-col gap-4 bg-lift p-6 md:p-8">
              <p className="numeral text-[clamp(1.9rem,3.3vw,3rem)]">{stat.value}</p>
              <p className="max-w-[26ch] text-[17px] leading-snug text-ivory">{stat.label}</p>
              <p className="mt-auto pt-2">
                <a
                  href={stat.source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="baseline text-[11px] tracking-[0.1em] text-mist underline decoration-ash/50 underline-offset-[0.45em] transition-colors duration-150 hover:text-ivory hover:decoration-signal"
                >
                  {stat.source.text}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
      <p className="mt-6 max-w-[62ch] text-[14px] leading-relaxed text-ash">
        Observed on Portaldot testnet and on the author’s machine.
      </p>
    </Section>
  );
}
