import { gutter, SectionHeading } from '../ui';

const gaps = [
  {
    word: 'The history',
    lost: "A CSV can't prove it holds every change, or that they're in order.",
    kept: 'Packout chains each encrypted change into a head hash that Portaldot keeps.',
  },
  {
    word: 'The authority',
    lost: 'Who may write lives in the vendor’s database, and leaves with it.',
    kept: 'The owner and the writer list live in a contract no vendor can edit.',
  },
  {
    word: 'The way forward',
    lost: 'A new app can show old data. It can’t continue it.',
    kept: 'Packout Restore picks up at the next operation of the same workspace.',
  },
];

export function LeftBehind() {
  return (
    <section aria-labelledby="left-behind" className={`${gutter} py-[clamp(6rem,14vw,11rem)]`}>
      <SectionHeading id="left-behind">
        An export is a file. You needed the workspace.
      </SectionHeading>
      <dl className="mt-16 space-y-14 md:mt-24 md:space-y-20">
        {gaps.map((gap) => (
          <div
            key={gap.word}
            className="grid gap-5 md:grid-cols-[minmax(0,15rem)_1fr_1fr] md:gap-12"
          >
            <dt className="baseline depth-0 text-[15px]">{gap.word}</dt>
            <dd className="text-[17px] leading-relaxed text-smoke line-through decoration-[#333331]">
              <span className="sr-only">With an ordinary export: </span>
              {gap.lost}
            </dd>
            <dd className="text-[17px] leading-relaxed text-ivory">
              <span className="sr-only">With Packout: </span>
              {gap.kept}
            </dd>
          </div>
        ))}
      </dl>
      <p className="prose-ash mt-20 md:mt-28">
        Your data stays encrypted on your devices. Portaldot only ever sees fingerprints and
        permissions, which is exactly enough to settle an argument about what happened.
      </p>
    </section>
  );
}
