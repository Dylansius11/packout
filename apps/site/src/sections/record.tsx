import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { block, REGISTRY, record } from '../content';
import { BlockLink } from '../ui';

export function Record() {
  return (
    <Section
      id="record"
      n="05"
      label="On the record"
      headingId="record-heading"
      heading="On the record, not on a slide."
    >
      <Pull className="mt-8">
        Every line below is a <mark>real transaction</mark> on Portaldot testnet.
      </Pull>
      <Reveal delay={100}>
        <p className="prose mt-6">
          Click any block and check it yourself; that is the whole point.
        </p>
      </Reveal>
      <Reveal delay={140} className="mt-12">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Packout transactions observed on Portaldot testnet</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">What happened</th>
              <th scope="col">Result</th>
              <th scope="col">Where</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair border-y border-hair">
            {record.map((row) => (
              <tr
                key={row.what}
                className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-4 md:table-row md:py-0"
              >
                <th
                  scope="row"
                  className="col-span-2 pb-1 text-[16px] font-normal text-mist transition-colors duration-150 group-hover:text-ivory md:w-[44%] md:py-5 md:pr-6 md:text-[18px]"
                >
                  {row.what}
                </th>
                <td className="baseline whitespace-normal text-[13px] text-ivory md:py-5 md:pr-6 md:text-[15px]">
                  {row.value}
                </td>
                <td className="text-right text-[12px] text-mist md:py-5 md:text-[13px]">
                  {row.height ? <BlockLink height={row.height} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <p className="mt-10 max-w-[70ch] text-[14px] leading-relaxed text-ash">
        Registry <span className="font-pixel text-mist">{REGISTRY}</span>, deployed in{' '}
        <a
          href={block(238168)}
          className="underline underline-offset-4 transition-colors duration-150 hover:text-ivory"
        >
          block 238168
        </a>
        . Fees are what the chain charged; storage-creating calls such as the first append cost more
        because Portaldot charges a one-time storage deposit.
      </p>
    </Section>
  );
}
