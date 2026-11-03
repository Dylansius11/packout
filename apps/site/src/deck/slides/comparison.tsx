import { Wordmark } from '@packout/brand';
import { comparison, type Mark } from '../content';
import { step } from '../motion';
import { Eyebrow, Frame, Headline, Src } from '../parts';

/** Yes is a bold amber check, partial a half-filled circle, no a muted dash. Each carries its word. */
function MarkCell({ kind, order }: { kind: Mark; order: number }) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`d-mark d-mark-${kind}`}
        style={step(order)}
        focusable="false"
      >
        {kind === 'yes' ? <path d="m4.5 12.5 5 5 10-11" /> : null}
        {kind === 'partial' ? (
          <>
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 4.5a7.5 7.5 0 0 0 0 15z" className="d-mark-fill" />
          </>
        ) : null}
        {kind === 'no' ? <path d="M7 12h10" /> : null}
      </svg>
      <span className="d-vh">{kind}</span>
    </>
  );
}

export function ComparisonSlide() {
  return (
    <Frame className="d-comparison">
      <div>
        <Eyebrow>{comparison.eyebrow}</Eyebrow>
        <Headline text={comparison.headline} accent="keep going." />
      </div>
      <div className="d-table-wrap">
        <table className="d-table">
          <caption className="d-vh">{comparison.headline}</caption>
          <thead>
            <tr>
              <td className="d-corner">
                <span className="d-vh">Criterion</span>
              </td>
              {comparison.columns.map((name, column) => (
                <th key={name} scope="col" className={column === 0 ? 'd-pk d-pk-head' : undefined}>
                  {column === 0 ? (
                    <>
                      <span className="d-th-wm">
                        <Wordmark size={15} />
                      </span>
                      <span className="d-th-txt">{name}</span>
                    </>
                  ) : (
                    name
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row, index) => {
              const last = index === comparison.rows.length - 1;
              return (
                <tr key={row.criterion} className="d-row rv" style={step(2 + index)}>
                  <th scope="row">{row.criterion}</th>
                  {row.marks.map((kind, column) => (
                    <td
                      key={comparison.columns[column]}
                      className={column === 0 ? `d-pk${last ? ' d-pk-last' : ''}` : undefined}
                    >
                      <MarkCell kind={kind} order={column === 0 ? index : 0} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="d-legend rv" style={step(9)}>
        {comparison.legend}
      </p>
      <p className="d-footnote rv" style={step(10)}>
        {comparison.footnote}
        <span className="d-footnote-links">
          {comparison.srcs.map((href) => (
            <Src key={href} href={href} />
          ))}
        </span>
      </p>
    </Frame>
  );
}
