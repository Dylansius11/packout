import { cliRun } from '../content';
import { gutter, SectionHeading } from '../ui';

const kit = [
  {
    name: 'PackoutRegistry',
    what: 'One small Solidity contract: per workspace, the owner, epoch, writers, operation count, schema and the head of its hash chain. Workspace contents never go on-chain.',
  },
  {
    name: '@packout/sdk',
    what: 'Encrypt on the device, anchor in batches, export, verify and rebuild the workspace state.',
  },
  {
    name: 'Bundle format v1',
    what: 'An open spec for the export. Ciphertext and a checkpoint, never the key.',
  },
  {
    name: 'Packout Restore',
    what: 'The independent client. It shares no code with the vendor app and never calls it; a test enforces that.',
  },
  {
    name: 'Verifier CLI',
    what: 'Written from the spec alone, sharing no code with the SDK, so you don’t have to take our word for the format.',
  },
];

export function Builders() {
  return (
    <section
      id="builders"
      aria-labelledby="builders-heading"
      className={`${gutter} scroll-mt-8 py-[clamp(5rem,10vw,8rem)]`}
    >
      <SectionHeading id="builders-heading">
        Give your users the exit before they ask.
      </SectionHeading>
      <p className="prose-ash mt-6">
        If you build a shared workspace, Packout is the part you don’t want to write yourself:
        verifiable export, restore somewhere else, and a clean handover of who may write.
      </p>

      <dl className="mt-16 grid gap-x-16 gap-y-10 md:grid-cols-2">
        {kit.map((part) => (
          <div key={part.name}>
            <dt className="baseline depth-0 text-[14px]">{part.name}</dt>
            <dd className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-ash">{part.what}</dd>
          </div>
        ))}
      </dl>

      <figure className="mt-24">
        <figcaption className="baseline depth-2 text-[11px] whitespace-normal">
          Real output, Portaldot testnet, 1 Nov 2026 · the Succession workspace, native history
          included
        </figcaption>
        <pre className="mt-6 overflow-x-auto font-pixel text-[12px] leading-[2] md:text-[13px]">
          <code>
            <span className="text-smoke">$ </span>
            <span className="text-ivory">{cliRun.command}</span>
            {'\n'}
            {cliRun.lines.map(([status, step, message]) => (
              <span key={step} className="block">
                <span className={status === 'PASS' ? 'text-ivory' : 'text-void bg-ash px-1'}>
                  {status}
                </span>
                <span className="text-ash"> {step}: </span>
                <span className="text-ash">{message}</span>
              </span>
            ))}
            <span className="text-ivory">Verification succeeded.</span>
          </code>
        </pre>
        <p className="mt-6 max-w-[60ch] text-[14px] leading-relaxed text-smoke">
          Without the key, decryption is reported as skipped, never as passed. Hand it the key file
          and it reads all six.
        </p>
      </figure>
    </section>
  );
}
