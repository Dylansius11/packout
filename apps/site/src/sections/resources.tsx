import { useId, useState } from 'react';
import { ArrowIcon, SearchIcon } from '../components/icons';
import { Reveal } from '../components/reveal';
import { Pull, Section } from '../components/section';
import { type ResourceTag, resources, resourceTags } from '../content';

type Filter = 'ALL' | ResourceTag;
const filters: Filter[] = ['ALL', ...resourceTags];

/** Chips and a search box filter the repository's parts live; the count is announced. */
export function Resources() {
  const searchId = useId();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const shown = resources.filter(
    (item) =>
      (filter === 'ALL' || item.tag === filter) &&
      (!needle ||
        `${item.title} ${item.what} ${item.path} ${item.tag}`.toLowerCase().includes(needle)),
  );

  function reset() {
    setFilter('ALL');
    setQuery('');
  }

  return (
    <Section
      id="resources"
      n="08"
      label="Resources"
      headingId="resources-heading"
      heading="Everything is in the repo."
      tone="panel"
    >
      <Pull className="mt-8">
        Every part of the kit has <mark>a folder you can read</mark>.
      </Pull>

      <Reveal delay={100} className="mt-10 md:mt-14">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="relative lg:w-72">
            <label htmlFor={searchId} className="sr-only">
              Search resources
            </label>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search resources"
              autoComplete="off"
              className="h-11 w-full rounded-full border border-hair-strong bg-black/50 pl-11 pr-4 text-[15px] text-ivory placeholder:text-ash focus:border-signal md:h-10"
            />
          </div>
          <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">Filter by type</legend>
            {filters.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={filter === name}
                onClick={() => setFilter(name)}
              >
                {name}
              </button>
            ))}
          </fieldset>
        </div>

        <p role="status" aria-live="polite" className="baseline depth-1 mt-6 text-[11px]">
          {shown.length === 0
            ? 'No resources match.'
            : `${shown.length} of ${resources.length} resources`}
        </p>

        {shown.length === 0 ? (
          <div className="card mt-4 flex flex-col items-start gap-4 p-8">
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-mist">
              Nothing in the repository matches
              {query.trim() ? ` “${query.trim()}”` : ' that filter'}. Try another word or clear the
              filters.
            </p>
            <button type="button" className="pill" onClick={reset}>
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <li key={item.path} className="flex">
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="card group flex w-full flex-col p-5 transition-[transform,border-color,background-color] duration-200 ease-[var(--ease-out)] hover:border-signal/60 hover:bg-signal/[0.05] active:scale-[0.985] md:p-6 [@media(hover:hover)]:hover:-translate-y-0.5"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="baseline rounded-full border border-signal/50 px-2.5 pb-0.5 pt-1 text-[10px] tracking-[0.14em] text-signal">
                      {item.tag}
                    </span>
                    <ArrowIcon className="size-5 text-ash transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal" />
                  </span>
                  <span className="mt-5 text-[19px] font-semibold leading-tight text-ivory">
                    {item.title}
                    <span className="sr-only"> (opens on GitHub in a new tab)</span>
                  </span>
                  <span className="mt-2 text-[15px] leading-relaxed text-mist">{item.what}</span>
                  <span className="mt-auto break-all pt-5 font-pixel text-[11px] tracking-[0.04em] text-ash">
                    {item.path}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </Section>
  );
}
