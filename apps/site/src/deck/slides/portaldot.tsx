import { portaldot } from '../content';
import { step } from '../motion';
import { Eyebrow, Frame, Headline, Src } from '../parts';

/** Each card opens on its fact and flips to what that fact buys, one card after another. */
export function PortaldotSlide() {
  return (
    <Frame className="d-portaldot">
      <div className="d-pd-head">
        <div>
          <Eyebrow>{portaldot.eyebrow}</Eyebrow>
          <Headline text={portaldot.headline} accent="referee." />
        </div>
        <p className="prose d-pd-sub rv" style={step(2)}>
          {portaldot.sub}
        </p>
      </div>
      <ul className="d-flips">
        {portaldot.cards.map((card, index) => (
          <li key={card.fact} className="d-flip" style={step(index)}>
            <div className="d-flip-inner">
              <div aria-hidden="true" className="d-flip-face d-flip-front">
                <span className="baseline d-flip-fact">{card.fact}</span>
              </div>
              <div className="d-flip-face d-flip-back card">
                <h3 className="baseline d-flip-fact">{card.fact}</h3>
                <p className="d-flip-line">{card.line}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="d-limits rv" style={step(9)}>
        <p className="baseline d-limits-label">{portaldot.limitsLabel}</p>
        <p>{portaldot.limits}</p>
      </div>
      <div className="d-pd-foot rv" style={step(10)}>
        <p>{portaldot.other}</p>
        <Src href={portaldot.src} />
      </div>
    </Frame>
  );
}
