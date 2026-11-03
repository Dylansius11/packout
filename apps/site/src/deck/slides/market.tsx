import { market } from '../content';
import { Count } from '../count';
import { step } from '../motion';
import { Eyebrow, Frame, Headline, Src } from '../parts';

export function MarketSlide() {
  const { context } = market;
  return (
    <Frame className="d-market">
      <div>
        <Eyebrow>{market.eyebrow}</Eyebrow>
        <Headline text={market.headline} accent="exit." />
      </div>
      <div className="d-market-grid">
        <section aria-label="Context" className="d-context rv" style={step(2)}>
          <p className="numeral d-context-n">
            <Count
              to={context.value}
              decimals={1}
              prefix={context.prefix}
              suffix={context.suffix}
            />
          </p>
          <p className="d-context-line">{context.line}</p>
          <Src href={context.src} />
          <ul className="d-rules">
            {market.rules.map((rule, index) => (
              <li key={rule.name} className="card d-rule rv" style={step(3 + index)}>
                <p className="baseline d-tag">{rule.name}</p>
                <p className="d-rule-line">{rule.line}</p>
                <Src href={rule.src} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-label={market.funnelLabel} className="d-funnel">
          <p className="baseline d-funnel-label rv" style={step(2)}>
            {market.funnelLabel}
            <span className="d-funnel-scale"> · bars not to scale</span>
          </p>
          <ol className="d-tiers">
            {market.funnel.map((tier, index) => (
              <li key={tier.tier} className="d-tier">
                <p className="d-tier-head rv" style={step(3 + index)}>
                  <span className="baseline d-tier-name">{tier.tier}</span>
                  <span className="numeral d-tier-n">
                    <Count
                      to={tier.value}
                      decimals={tier.value % 1 === 0 ? 0 : 1}
                      prefix={tier.prefix}
                      suffix={tier.suffix}
                      tail={tier.tail}
                      delay={700 + index * 450}
                    />
                  </span>
                </p>
                <div
                  aria-hidden="true"
                  className="d-tier-bar"
                  style={{ ...step(3 + index), width: `${tier.width}%` }}
                />
                <p className="d-tier-line rv" style={step(4 + index)}>
                  {tier.line}
                </p>
              </li>
            ))}
          </ol>
          <p className="d-caption rv" style={step(8)}>
            {market.caption}
          </p>
        </section>
      </div>
      <p className="pull d-closing rv" style={step(9)}>
        {market.closing}
      </p>
    </Frame>
  );
}
