import { useState } from 'react';
import { checks, tampers } from '../content';
import { gutter, SectionHeading } from '../ui';

/** Replays the real verifier's order: everything after the first failure is never looked at. */
export function Checks() {
  const [tamper, setTamper] = useState(0);
  const breaks = tampers[tamper].breaks;
  const failAt = breaks ? checks.findIndex((check) => check.id === breaks) : -1;

  return (
    <section aria-labelledby="checks-heading" className={`${gutter} py-[clamp(5rem,10vw,8rem)]`}>
      <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-24">
        <div>
          <SectionHeading id="checks-heading">
            Nothing opens until the file proves itself.
          </SectionHeading>
          <p className="prose-ash mt-6">
            Packout Restore runs six checks in a fixed order, against the chain, before it shows a
            single issue. A failed check stops everything after it and says what is wrong in plain
            words.
          </p>
          <fieldset className="mt-10">
            <legend className="baseline depth-2 text-[12px]">Try to break the file</legend>
            <div className="mt-5 flex flex-wrap gap-x-3 gap-y-3">
              {tampers.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={index === tamper}
                  onClick={() => setTamper(index)}
                  className={`baseline command px-3 py-2.5 text-[12px] tracking-[0.1em] transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
                    index === tamper ? 'bg-ivory text-void' : 'text-ash hover:text-ivory'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="mt-6 text-[13px] leading-relaxed text-smoke">
            An illustration of the order and wording the real verifier uses. Run it for real in
            Packout Restore or with the CLI below.
          </p>
        </div>

        <ol
          aria-label="Verification steps, illustrated"
          aria-live="polite"
          className="space-y-7 self-center"
        >
          {checks.map((check, index) => {
            const status =
              failAt === -1 || index < failAt ? 'pass' : index === failAt ? 'fail' : 'idle';
            return (
              <li key={check.id} className="grid grid-cols-[7.5rem_1fr] items-baseline gap-x-5">
                <span
                  key={`${tamper}-${status}`}
                  className={`baseline surface text-[12px] [--order:0] ${
                    status === 'pass'
                      ? 'depth-1'
                      : status === 'fail'
                        ? 'reversed justify-self-start tracking-[0.12em]'
                        : 'text-smoke tracking-[0.06em]'
                  }`}
                >
                  {status === 'pass' ? 'Pass' : status === 'fail' ? 'Failed' : 'Not checked'}
                </span>
                <div>
                  <p
                    className={`baseline text-[clamp(0.9375rem,1.3vw,1.125rem)] whitespace-normal ${status === 'idle' ? 'depth-2' : 'depth-0'}`}
                  >
                    {check.title}
                  </p>
                  <p
                    className={`mt-2 text-[15px] leading-relaxed ${status === 'fail' ? 'text-ivory' : status === 'idle' ? 'text-smoke' : 'text-ash'}`}
                  >
                    {status === 'fail' ? check.failure : check.asks}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
