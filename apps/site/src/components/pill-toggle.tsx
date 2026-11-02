import { type KeyboardEvent, useRef } from 'react';

export interface PillOption<T extends string> {
  id: T;
  label: string;
}

/** Ids that tie a toggle option to the panel it controls. */
export function pillIds(base: string, id: string) {
  return { tab: `${base}-tab-${id}`, panel: `${base}-panel-${id}` };
}

/**
 * The rounded Human / Agent switch. A tablist: one tab stops, arrows move between options.
 * The consumer renders one `role="tabpanel"` per option using `pillIds`.
 */
export function PillToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  idBase,
  className = '',
}: {
  options: readonly PillOption<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idBase: string;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = (index + 1) % options.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    const id = options[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative inline-grid auto-cols-fr grid-flow-col rounded-full border border-hair-strong bg-white/[0.05] p-1 ${className}`}
    >
      <span
        aria-hidden="true"
        className="pill-thumb"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.id === value;
        const ids = pillIds(idBase, option.id);
        return (
          <button
            key={option.id}
            ref={(node) => {
              refs.current[option.id] = node;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={`baseline relative z-10 inline-flex min-h-11 min-w-24 items-center justify-center rounded-full px-5 pt-0.5 text-[12px] tracking-[0.14em] transition-colors duration-200 active:scale-[0.97] md:min-h-10 ${
              selected ? 'text-void' : 'text-mist hover:text-ivory'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
