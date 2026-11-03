import { business } from '../content';
import { step } from '../motion';
import { Eyebrow, Frame, Headline } from '../parts';

export function BusinessSlide() {
  const { benchmark } = business;
  return (
    <Frame className="d-business">
      <div>
        <Eyebrow>{business.eyebrow}</Eyebrow>
        <Headline text={business.headline} accent="Paid continuity." />
      </div>
      <div className="d-plans">
        <section aria-label={business.free.label} className="card d-plan rv" style={step(2)}>
          <h3 className="baseline d-plan-label">{business.free.label}</h3>
          <ul className="d-plan-list">
            {business.free.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="d-plan-note">{business.free.note}</p>
        </section>
        <section
          aria-label={business.paid.label}
          className="panel d-plan d-plan-paid"
          style={step(5)}
        >
          <h3 className="baseline d-plan-label">{business.paid.label}</h3>
          <ul className="d-plan-list">
            {business.paid.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <p className="d-price rv" style={step(7)}>
        {business.price}
      </p>
      <p className="d-bench rv" style={step(8)}>
        {benchmark.before}
        <a
          href={benchmark.codekeeperSrc}
          target="_blank"
          rel="noreferrer"
          className="d-inline-link"
        >
          {benchmark.codekeeper}
          <span className="d-vh"> (opens in a new tab)</span>
        </a>
        {benchmark.middle}
        <a href={benchmark.escrowSrc} target="_blank" rel="noreferrer" className="d-inline-link">
          {benchmark.escrow}
          <span className="d-vh"> (opens in a new tab)</span>
        </a>
        {benchmark.after}
      </p>
    </Frame>
  );
}
