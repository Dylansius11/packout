import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { succession } from '../content';
import { BlockLink } from '../ui';

export function Succession() {
  return (
    <Section
      n="06"
      label="Succession"
      headingId="succession-heading"
      heading="And if the owner’s key is gone too?"
      tone="panel"
    >
      <div className="mt-8 grid gap-14 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-20">
        <div>
          <Pull>
            A named inheritor acts as the same owner account. The contract sees the same owner, so{' '}
            <mark>nothing about the workspace has to change</mark>.
          </Pull>
          <Reveal delay={100}>
            <p className="prose mt-8">
              Portaldot ships account recovery in the runtime itself. Three backup wallets, two have
              to agree, then a waiting period the real owner can still cancel.
            </p>
            <p className="prose mt-5 text-ash">
              On other EVM chains, a Safe with a recovery module can reach a similar outcome. Here
              the recovery authority is the chain's own, and Packout reuses it.
            </p>
          </Reveal>
        </div>

        <Reveal delay={140} className="self-end">
          <ol className="card relative space-y-0 p-6 md:p-8">
            {succession.map((step, index) => (
              <li
                key={step.line}
                className="relative grid grid-cols-[2.25rem_1fr] gap-x-4 pb-7 last:pb-0"
              >
                {index < succession.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[0.6875rem] top-7 w-px bg-hair-strong"
                  />
                ) : null}
                <span className="baseline relative z-10 flex size-6 items-center justify-center rounded-full border border-signal bg-lift pt-0.5 text-[10px] text-signal">
                  {index + 1}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                  <span className="text-[16px] leading-snug text-ivory">{step.line}</span>
                  {step.height ? (
                    <span className="text-[12px] text-mist">
                      <BlockLink height={step.height} />
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-[56ch] text-[14px] leading-relaxed text-ash">
            Tested on testnet from scripts on 30 Oct 2026. For that run every backup share sat on
            one machine, so it proves the mechanism, not independent custody. The browser panel for
            it isn’t built yet.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
