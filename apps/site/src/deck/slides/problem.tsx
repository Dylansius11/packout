import { problem } from '../content';
import { Count } from '../count';
import { step } from '../motion';
import { Eyebrow, Frame, Headline, Pull, Src } from '../parts';

export function ProblemSlide() {
  const { evidence } = problem;
  return (
    <Frame className="d-problem">
      <div className="d-problem-top">
        <div>
          <Eyebrow>{problem.eyebrow}</Eyebrow>
          <Headline text={problem.headline} accent="database." />
        </div>
        <aside className="panel d-evidence rv" style={step(7)}>
          <p className="numeral d-evidence-n">
            <Count to={evidence.count} suffix={evidence.of} delay={1500} duration={900} />
          </p>
          <p className="d-evidence-line">{evidence.line}</p>
          <p className="d-evidence-cap">{evidence.caption}</p>
        </aside>
      </div>
      <ol className="d-years">
        {problem.cards.map((card, index) => (
          <li key={card.product} className="card d-year rv" style={step(2 + index)}>
            <p className="numeral d-year-n">{card.year}</p>
            <h3 className="d-year-name">{card.product}</h3>
            <p className="d-year-line">{card.line}</p>
            <Src href={card.src} />
          </li>
        ))}
      </ol>
      <Pull text={problem.punchline} mark="no proof, and no right to keep writing." order={8} />
    </Frame>
  );
}
