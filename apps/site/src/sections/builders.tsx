import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { cliRun } from '../content';

const kit = [
  {
    name: 'PackoutRegistry',
    what: 'One small Solidity contract: per workspace, the owner, epoch, writers, operation count, schema and the head of its hash chain. Workspace contents never go on-chain.',
    span: 'lg:col-span-4',
    lead: true,
  },
  {
    name: '@packout/sdk',
    what: 'Encrypt on the device, anchor in batches, export, verify and rebuild the workspace state.',
    span: 'lg:col-span-2',
  },
  {
    name: 'Bundle format v1',
    what: 'An open spec for the export. Ciphertext and a checkpoint, never the key.',
    span: 'lg:col-span-2',
  },
  {
    name: 'Packout Restore',
    what: 'The independent client. It shares no code with the vendor app and never calls it; a test enforces that.',
    span: 'lg:col-span-2',
  },
  {
    name: 'Verifier CLI',
    what: 'Written from the spec alone, sharing no code with the SDK, so you don’t have to take our word for the format.',
    span: 'lg:col-span-2',
  },
];

export function Builders() {
  return (
    <Section
      id="builders"
      n="07"
      label="For builders"
      headingId="builders-heading"
      heading="Give your users the exit before they ask."
    >
      <Pull className="mt-8">
        If you build a shared workspace, Packout is{' '}
        <mark>the part you don’t want to write yourself</mark>.
      </Pull>
      <Reveal delay={100}>
        <p className="prose mt-6">
          Verifiable export, restore somewhere else, and a clean handover of who may write.
        </p>
      </Reveal>

      <dl className="mt-14 grid gap-4 lg:grid-cols-6">
        {kit.map((part, index) => (
          <Reveal
            key={part.name}
            delay={index * 60}
            className={`card relative p-6 md:p-7 ${part.span} ${part.lead ? 'bg-signal/[0.05] border-signal/30' : ''}`}
          >
            <dt className="baseline flex items-center gap-3 text-[14px] text-ivory">
              <span aria-hidden="true" className="size-1.5 bg-signal" />
              {part.name}
            </dt>
            <dd
              className={`mt-4 leading-relaxed text-mist ${part.lead ? 'max-w-[52ch] text-[18px]' : 'text-[16px]'}`}
            >
              {part.what}
            </dd>
          </Reveal>
        ))}
      </dl>

      <Reveal className="mt-20">
        <figure>
          <figcaption className="baseline depth-1 whitespace-normal text-[11px]">
            Real output, Portaldot testnet, 1 Nov 2026 · the Succession workspace, native history
            included
          </figcaption>
          <div className="mt-4 overflow-hidden rounded-2xl border border-hair-strong bg-black">
            <pre className="overflow-x-auto p-5 font-pixel text-[12px] leading-[2] md:p-7 md:text-[13px]">
              <code>
                <span className="text-signal">$ </span>
                <span className="text-ivory">{cliRun.command}</span>
                {'\n'}
                {cliRun.lines.map(([status, step, message]) => (
                  <span key={step} className="block">
                    <span className={status === 'PASS' ? 'text-signal' : 'bg-ash px-1 text-void'}>
                      {status}
                    </span>
                    <span className="text-ivory"> {step}: </span>
                    <span className="text-mist">{message}</span>
                  </span>
                ))}
                <span className="text-ivory">Verification succeeded.</span>
              </code>
            </pre>
          </div>
          <p className="mt-6 max-w-[60ch] text-[14px] leading-relaxed text-ash">
            Without the key, decryption is reported as skipped, never as passed. Hand it the key
            file and it reads all six.
          </p>
        </figure>
      </Reveal>
    </Section>
  );
}
