import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';

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
    <Section
      n="01"
      label="The problem"
      headingId="left-behind"
      heading="An export is a file. You needed the workspace."
    >
      <dl className="mt-14 space-y-5 md:mt-20">
        {gaps.map((gap, index) => (
          <Reveal
            key={gap.word}
            delay={index * 70}
            className="grid gap-4 md:grid-cols-[minmax(0,13rem)_1fr_1.15fr] md:gap-8"
          >
            <dt className="baseline depth-0 pt-1 text-[15px] md:pt-5">{gap.word}</dt>
            <dd className="px-1 text-[17px] leading-relaxed text-ash line-through decoration-smoke md:p-5">
              <span className="sr-only">With an ordinary export: </span>
              {gap.lost}
            </dd>
            <dd className="rounded-2xl border border-signal/30 bg-signal/[0.07] p-5 text-[17px] leading-relaxed text-ivory">
              <span className="sr-only">With Packout: </span>
              {gap.kept}
            </dd>
          </Reveal>
        ))}
      </dl>
      <Pull className="mt-20 md:mt-28">
        Your data stays encrypted on your devices. Portaldot only ever sees{' '}
        <mark>fingerprints and permissions</mark>, which is exactly enough to settle an argument
        about what happened.
      </Pull>
    </Section>
  );
}
