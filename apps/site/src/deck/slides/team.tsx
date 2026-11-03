import { team } from '../content';
import { Count } from '../count';
import { step } from '../motion';
import { Eyebrow } from '../parts';

/** Left half: the founder, full-bleed. Right half: the record. Stacks on a phone. */
export function TeamSlide() {
  return (
    <div className="d-scroll">
      <div className="d-team">
        <figure className="d-photo">
          <img
            src="/deck/founder.webp"
            width={1000}
            height={1000}
            alt={`Pixel-art portrait of ${team.name}`}
            className="d-photo-img"
          />
          <span aria-hidden="true" className="d-photo-scan" />
          <figcaption className="d-namecard rv" style={step(3)}>
            <span className="d-name">{team.name}</span>
            <span className="baseline d-role">{team.role}</span>
          </figcaption>
        </figure>

        <div className="d-team-panel">
          <Eyebrow>{team.eyebrow}</Eyebrow>
          <h2 className="d-h d-team-h rv" style={step(1)}>
            {team.headline.map((line) => (
              <span key={line.text}>
                {line.text}
                <span className="d-accent">{line.accent}</span>
              </span>
            ))}
          </h2>
          <ul className="d-trio">
            {team.stats.map((stat, index) => (
              <li key={stat.line} className="d-trio-cell rv" style={step(2 + index)}>
                <span className="numeral d-trio-n">
                  {'count' in stat ? (
                    <Count to={stat.count} suffix={stat.suffix} delay={600 + index * 200} />
                  ) : (
                    stat.text
                  )}
                </span>
                <span className="d-trio-line">{stat.line}</span>
              </li>
            ))}
          </ul>
          <dl className="d-rows">
            {team.rows.map((row, index) => (
              <div key={row.label} className="d-rowline rv" style={step(5 + index)}>
                <dt className="baseline depth-1">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="d-team-small rv" style={step(9)}>
            {team.small}
          </p>
          <div className="d-looking rv" style={step(10)}>
            <p className="baseline d-looking-label">{team.lookingFor.label}</p>
            <ul>
              {team.lookingFor.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
