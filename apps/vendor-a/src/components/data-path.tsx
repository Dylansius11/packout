import { AnchorSimple, CloudArrowUp, Laptop } from '@phosphor-icons/react';

const STAGES = [
  {
    Icon: Laptop,
    title: 'On this device',
    text: 'Encrypted and saved here first. It survives a reload.',
  },
  {
    Icon: CloudArrowUp,
    title: 'Sent to vendor',
    text: 'Vendor A holds the encrypted data. It cannot read it.',
  },
  {
    Icon: AnchorSimple,
    title: 'Anchored on Portaldot',
    text: 'Admitted to the workspace history by the chain, with a position and a block.',
  },
] as const;

/** The three places a change can live, as a path with a rail. Same words the sync badge uses. */
export function DataPath({ headingId, level = 2 }: { headingId: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <Heading id={headingId} className="display text-xl">
        Where your data lives
      </Heading>
      <p className="text-sm text-muted-foreground">
        Every change is encrypted on your device before it goes anywhere. Each one shows how far it
        got:
      </p>
      <ol className="relative space-y-5">
        {STAGES.map(({ Icon, title, text }, index) => (
          <li key={title} className="relative flex gap-3.5 text-sm">
            {index < STAGES.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 -bottom-[1.4rem] w-px bg-border-strong"
              />
            ) : null}
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground">
              <Icon size={16} aria-hidden />
            </span>
            <span className="pt-1">
              <span className="font-medium">{title}.</span>{' '}
              <span className="text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
