import { DustField } from '@packout/brand';
import { Aurora } from '../../components/aurora';
import { close } from '../content';
import { step, useLinger, useSlide } from '../motion';
import { Eyebrow, Frame, SweepLines } from '../parts';

function CloseBackdrop() {
  const { active } = useSlide();
  const live = useLinger(active, 700);
  return (
    <div className="d-bg" aria-hidden="true">
      <Aurora />
      {live ? (
        <DustField className="d-dust" anchor="end" mirror intensity={0.16} interactive={false} />
      ) : null}
      <div className="d-scrim d-scrim-close" />
    </div>
  );
}

export function CloseSlide() {
  return (
    <Frame backdrop={<CloseBackdrop />} className="d-close">
      <div>
        <Eyebrow>{close.eyebrow}</Eyebrow>
        <h2 className="display d-giant">
          <SweepLines lines={close.lines} stepMs={1200} />
        </h2>
      </div>
      <ul className="d-asks">
        {close.asks.map((ask, index) => (
          <li key={ask.from} className="card d-ask rv" style={step(26 + index)}>
            <p className="baseline d-tag">{ask.from}</p>
            <p className="d-ask-line">{ask.line}</p>
          </li>
        ))}
      </ul>
      <div className="d-planned rv" style={step(29)}>
        <p className="baseline d-planned-label">{close.plannedLabel}</p>
        <ul>
          {close.planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <ul className="d-links rv" style={step(31)}>
        {close.links.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noreferrer" className="d-link">
              {link.label}
              <span aria-hidden="true"> ↗</span>
              <span className="d-vh"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="d-closefoot rv" style={step(33)}>
        <p className="baseline depth-1">{close.footer}</p>
        <button type="button" className="pill d-print" onClick={() => window.print()}>
          {close.print}
        </button>
      </div>
    </Frame>
  );
}
