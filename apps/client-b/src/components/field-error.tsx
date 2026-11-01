import type { ReactNode } from 'react';

/** A refusal tied to one field: the reversed word, then the sentence that says exactly what is wrong. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[16px] leading-snug text-ivory"
    >
      <span aria-hidden className="baseline reversed text-[11px]">
        Failed
      </span>
      <span className="min-w-0 flex-1 basis-60">
        <span className="sr-only">Failed: </span>
        {children}
      </span>
    </p>
  );
}
