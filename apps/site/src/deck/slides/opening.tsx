import { DustField } from '@packout/brand';
import { Aurora } from '../../components/aurora';
import { opening } from '../content';
import { step, useLinger, useSlide } from '../motion';
import { Frame, SweepLines } from '../parts';

/** Dust and aurora behind the title, like the landing's hero; dust only runs while it is seen. */
export function OpeningBackdrop() {
  const { active } = useSlide();
  const live = useLinger(active, 700);
  return (
    <div className="d-bg" aria-hidden="true">
      <Aurora />
      {live ? (
        <DustField className="d-dust" anchor="end" mirror intensity={0.2} interactive={false} />
      ) : null}
      <div className="d-scrim" />
    </div>
  );
}

export function OpeningSlide() {
  const dot = <span aria-hidden="true" className="d-dot" />;
  return (
    <Frame backdrop={<OpeningBackdrop />} className="d-open">
      <div className="d-open-copy">
        <p className="eyebrow d-eyebrow rv" style={step(0)}>
          {opening.eyebrow}
        </p>
        <p className="d-event rv" style={step(1)}>
          {opening.event}
        </p>
        <h1 className="display d-title">
          <SweepLines lines={opening.lines} stepMs={800} />
        </h1>
        <p className="prose d-sub rv" style={step(26)}>
          {opening.sub}
        </p>
        <ul className="d-chips rv" style={step(28)}>
          {opening.chips.map((chip) => (
            <li key={chip.text}>
              {'href' in chip ? (
                <a
                  href={chip.href}
                  target="_blank"
                  rel="noreferrer"
                  className="baseline d-chip d-chip-link"
                >
                  {dot}
                  {chip.text}
                  <span className="d-vh"> on the Portaldot explorer (opens in a new tab)</span>
                </a>
              ) : (
                <span className="baseline d-chip">
                  {dot}
                  {chip.text}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="baseline depth-2 d-hint rv" style={step(31)}>
        {opening.hint}
        <span aria-hidden="true" className="caret" />
      </p>
    </Frame>
  );
}
