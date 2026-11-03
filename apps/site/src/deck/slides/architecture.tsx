import { architecture } from '../content';
import { ArchitectureDiagram } from '../diagram';
import { step } from '../motion';
import { Eyebrow, Frame, Headline } from '../parts';

export function ArchitectureSlide() {
  return (
    <Frame className="d-arch">
      <div>
        <Eyebrow>{architecture.eyebrow}</Eyebrow>
        <Headline text={architecture.headline} accent="independent client." />
      </div>
      <ArchitectureDiagram />
      <div className="d-arch-under rv" style={step(14)}>
        <p className="d-pills">
          {architecture.pills.map((pill) => (
            <code key={pill} className="d-pill">
              {pill}
            </code>
          ))}
          <span className="d-pills-note">{architecture.pillsNote}</span>
        </p>
        <p className="d-formula">{architecture.formula}</p>
      </div>
      <ul className="d-callouts">
        {architecture.callouts.map((text, index) => (
          <li key={text} className="d-callout rv" style={step(15 + index)}>
            {text}
          </li>
        ))}
      </ul>
    </Frame>
  );
}
