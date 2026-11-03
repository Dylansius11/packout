import { audience } from '../content';
import { step } from '../motion';
import { Eyebrow, Frame, Headline } from '../parts';

export function AudienceSlide() {
  return (
    <Frame className="d-audience">
      <div>
        <Eyebrow>{audience.eyebrow}</Eyebrow>
        <Headline text={audience.headline} accent="One buyer." />
      </div>
      <ul className="d-people">
        {audience.cards.map((card, index) => {
          const buyer = index === audience.cards.length - 1;
          return (
            <li
              key={card.tag}
              className={`d-person rv ${buyer ? 'panel d-person-buyer' : 'card'}`}
              style={step(2 + index)}
            >
              <p className="baseline d-tag">{card.tag}</p>
              <h3 className="d-person-title">{card.title}</h3>
              <p className="d-person-line">{card.line}</p>
            </li>
          );
        })}
      </ul>
      <p className="d-bottom rv" style={step(6)}>
        {audience.bottom}
      </p>
    </Frame>
  );
}
