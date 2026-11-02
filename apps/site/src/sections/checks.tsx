import { useState } from 'react';
import { CheckIcon } from '../components/icons';
import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { checks, tampers } from '../content';

/** Replays the real verifier's order: everything after the first failure is never looked at. */
export function Checks() {
  const [tamper, setTamper] = useState(0);
  const breaks = tampers[tamper].breaks;
  const failAt = breaks ? checks.findIndex((check) => check.id === breaks) : -1;

  return (
    <Section
      n="03"
      label="The checks"
      headingId="checks-heading"
      heading="Nothing opens until the file proves itself."
    >
      <div className="mt-8 grid gap-14 lg:grid-cols-[minmax(0,27rem)_1fr] lg:gap-20">
        <div>
          <Pull>
            A failed check <mark>stops everything after it</mark> and says what is wrong in plain
            words.
          </Pull>
          <Reveal delay={100}>
            <p className="prose mt-6">
              Packout Restore runs six checks in a fixed order, against the chain, before it shows a
              single issue.
            </p>
            <fieldset className="mt-10">
              <legend className="baseline depth-0 text-[12px]">Try to break the file</legend>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {tampers.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={index === tamper}
                    onClick={() => setTamper(index)}
                    className="chip"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="mt-6 text-[14px] leading-relaxed text-ash">
              An illustration of the order and wording the real verifier uses. Run it for real in
              Packout Restore or with the CLI below.
            </p>
          </Reveal>
        </div>

        <Reveal delay={140} className="self-start">
          <ol
            aria-label="Verification steps, illustrated"
            aria-live="polite"
            className="card divide-y divide-hair overflow-hidden"
          >
            {checks.map((check, index) => {
              const status =
                failAt === -1 || index < failAt ? 'pass' : index === failAt ? 'fail' : 'idle';
              return (
                <li
                  key={check.id}
                  className={`grid grid-cols-[1fr] gap-x-5 gap-y-2 px-5 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-baseline md:px-6 ${
                    status === 'fail' ? 'bg-signal/[0.07]' : ''
                  }`}
                >
                  <span
                    key={`${tamper}-${status}`}
                    className={`baseline surface inline-flex items-center gap-2 text-[12px] [--order:0] ${
                      status === 'pass'
                        ? 'text-ivory tracking-[0.12em]'
                        : status === 'fail'
                          ? 'reversed justify-self-start tracking-[0.12em]'
                          : 'text-ash tracking-[0.06em]'
                    }`}
                  >
                    {status === 'pass' ? <CheckIcon className="size-3.5 text-signal" /> : null}
                    {status === 'pass' ? 'Pass' : status === 'fail' ? 'Failed' : 'Not checked'}
                  </span>
                  <div>
                    <p
                      className={`baseline whitespace-normal text-[clamp(0.9375rem,1.3vw,1.0625rem)] ${status === 'idle' ? 'text-ash' : 'text-ivory'}`}
                    >
                      {check.title}
                    </p>
                    <p
                      className={`mt-1.5 text-[15px] leading-relaxed ${status === 'fail' ? 'text-ivory' : 'text-mist'} ${status === 'idle' ? 'opacity-80' : ''}`}
                    >
                      {status === 'fail' ? check.failure : check.asks}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </Section>
  );
}
