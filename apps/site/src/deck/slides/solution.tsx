import { solution } from '../content';
import { step } from '../motion';
import { Eyebrow, Frame, Headline } from '../parts';

export function SolutionSlide() {
  return (
    <Frame className="d-solution">
      <div>
        <Eyebrow>{solution.eyebrow}</Eyebrow>
        <Headline text={solution.headline} accent="Take over." />
      </div>
      {/* Each step lights its node, then the connector to the next one fills. */}
      <ol className="d-steps">
        {solution.steps.map((item, index) => (
          <li key={item.title} className="d-step" style={step(index)}>
            <span aria-hidden="true" className="d-step-node numeral">
              {index + 1}
            </span>
            {index < solution.steps.length - 1 ? (
              <span aria-hidden="true" className="d-step-link" />
            ) : null}
            <h3 className="d-step-title d-step-text">{item.title}</h3>
            <p className="d-step-line d-step-text">{item.line}</p>
          </li>
        ))}
      </ol>
      <p className="baseline depth-1 d-foot rv" style={step(8)}>
        {solution.footer}
      </p>
    </Frame>
  );
}
