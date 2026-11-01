import { succession } from '../content';
import { BlockLink, gutter, SectionHeading } from '../ui';

export function Succession() {
  return (
    <section
      aria-labelledby="succession-heading"
      className={`${gutter} py-[clamp(5rem,10vw,8rem)]`}
    >
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-24">
        <div>
          <SectionHeading id="succession-heading">
            And if the owner’s key is gone too?
          </SectionHeading>
          <p className="prose-ash mt-6">
            Portaldot ships account recovery in the runtime itself. Three backup wallets, two have
            to agree, then a waiting period the real owner can still cancel. After that, a named
            inheritor acts as the same owner account. The contract sees the same owner, so nothing
            about the workspace has to change.
          </p>
          <p className="prose-ash mt-6">
            On other EVM chains, a Safe with a recovery module can reach a similar outcome. Here the
            recovery authority is the chain's own, and Packout reuses it.
          </p>
        </div>
        <div className="self-end">
          <ol className="space-y-5">
            {succession.map((step) => (
              <li
                key={step.line}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
              >
                <span className="baseline depth-0 text-[13px] whitespace-normal md:text-[14px]">
                  {step.line}
                </span>
                {step.height ? (
                  <span className="text-[12px] text-ash">
                    <BlockLink height={step.height} />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-[56ch] text-[14px] leading-relaxed text-smoke">
            Tested on testnet from scripts on 30 Oct 2026. For that run every backup share sat on
            one machine, so it proves the mechanism, not independent custody. The browser panel for
            it isn’t built yet.
          </p>
        </div>
      </div>
    </section>
  );
}
