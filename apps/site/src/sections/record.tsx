import { block, REGISTRY, record } from '../content';
import { BlockLink, gutter, SectionHeading } from '../ui';

export function Record() {
  return (
    <section
      id="record"
      aria-labelledby="record-heading"
      className={`${gutter} scroll-mt-8 py-[clamp(5rem,10vw,8rem)]`}
    >
      <SectionHeading id="record-heading">On the record, not on a slide.</SectionHeading>
      <p className="prose-ash mt-6">
        Every line below is a real transaction on Portaldot testnet. Click any block and check it
        yourself; that is the whole point.
      </p>
      <table className="mt-14 w-full border-collapse text-left">
        <caption className="sr-only">Packout transactions observed on Portaldot testnet</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">What happened</th>
            <th scope="col">Result</th>
            <th scope="col">Where</th>
          </tr>
        </thead>
        <tbody>
          {record.map((row) => (
            <tr
              key={row.what}
              className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3 md:table-row md:py-0"
            >
              <th
                scope="row"
                className="col-span-2 pb-1 text-[16px] font-normal text-ash md:py-4 md:pr-6 transition-colors duration-150 group-hover:text-ivory md:text-[18px]"
              >
                {row.what}
              </th>
              <td className="baseline depth-0 text-[13px] whitespace-normal md:py-4 md:pr-6 md:text-[15px]">
                {row.value}
              </td>
              <td className="text-right text-[12px] text-ash md:py-4 md:text-[13px]">
                {row.height ? <BlockLink height={row.height} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-10 max-w-[70ch] text-[14px] leading-relaxed text-smoke">
        Registry <span className="font-pixel text-ash">{REGISTRY}</span>, deployed in{' '}
        <a href={block(238168)} className="underline underline-offset-4 hover:text-ivory">
          block 238168
        </a>
        . Fees are what the chain charged; storage-creating calls such as the first append cost more
        because Portaldot charges a one-time storage deposit.
      </p>
    </section>
  );
}
