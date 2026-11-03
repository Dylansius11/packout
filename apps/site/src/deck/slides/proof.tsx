import { CommandBlock } from '../../components/command-block';
import { proof } from '../content';
import { Count } from '../count';
import { step } from '../motion';
import { Eyebrow, Frame, Headline, Src } from '../parts';

export function ProofSlide() {
  const { registry } = proof;
  return (
    <Frame className="d-proof">
      <div>
        <Eyebrow>{proof.eyebrow}</Eyebrow>
        <Headline text={proof.headline} accent="Real transactions." />
      </div>
      <ul className="d-stats">
        {proof.stats.map((stat, index) => {
          const body = (
            <>
              <span className="numeral d-stat-n">
                <Count
                  to={stat.value}
                  suffix={'suffix' in stat ? stat.suffix : ''}
                  delay={500 + index * 160}
                />
              </span>
              <span className="d-stat-text">{stat.text}</span>
            </>
          );
          return (
            <li key={stat.text} className="d-stat rv" style={step(2 + index)}>
              {'href' in stat ? (
                <a href={stat.href} target="_blank" rel="noreferrer" className="d-stat-cell">
                  {body}
                  <span aria-hidden="true" className="d-stat-go">
                    ↗
                  </span>
                  <span className="d-vh"> on the Portaldot explorer (opens in a new tab)</span>
                </a>
              ) : (
                <div className="d-stat-cell">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="d-facts rv" style={step(7)}>
        <p>{proof.stale}</p>
        <p>
          {registry.before}
          <a href={registry.href} target="_blank" rel="noreferrer" className="d-inline-link">
            {registry.link}
            <span className="d-vh"> on the Portaldot explorer (opens in a new tab)</span>
          </a>
          {registry.after}
        </p>
      </div>
      <div className="d-cmd rv" style={step(8)}>
        <CommandBlock className="type-out" label={proof.commandLabel} text={proof.command} />
      </div>
      <div className="d-src-row rv" style={step(9)}>
        <Src href={proof.src} />
      </div>
    </Frame>
  );
}
