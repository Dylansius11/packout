import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * A command you can read, select and copy. The copy button confirms with a check and the word
 * "Copied". A failed copy selects the text and says so, so the user can finish with the keyboard.
 */
export function CommandBlock({
  text,
  label,
  prompt = true,
  className = '',
}: {
  text: string;
  /** Names the block for sighted and screen-reader users, e.g. "Install". */
  label?: string;
  /** Show the amber `$`. Off for code that is not a shell command. */
  prompt?: boolean;
  className?: string;
}) {
  const code = useRef<HTMLElement>(null);
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state !== 'copied') return;
    const timer = window.setTimeout(() => setState('idle'), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      const node = code.current;
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setState('failed');
    }
  }

  return (
    <div className={className}>
      {label ? <p className="baseline depth-2 mb-2 text-[11px]">{label}</p> : null}
      <div className="flex items-start gap-3 rounded-2xl border border-hair-strong bg-black/70 py-1.5 pl-4 pr-1.5">
        {prompt ? (
          <span aria-hidden="true" className="font-pixel pt-[0.55rem] text-[13px] text-signal">
            $
          </span>
        ) : null}
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words py-2 font-pixel text-[12px] leading-[1.9] text-ivory md:text-[13px]">
          <code ref={code}>{text}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={label ? `Copy ${label}` : 'Copy command'}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-mist transition-[transform,background-color,color] duration-150 hover:bg-white/10 hover:text-ivory active:scale-[0.94]"
        >
          {state === 'copied' ? (
            <span key="copied" className="pop text-signal">
              <CheckIcon />
            </span>
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="baseline mt-2 min-h-[1.45em] whitespace-normal text-[11px] text-ash"
      >
        {state === 'copied' ? <span className="text-signal">Copied</span> : null}
        {state === 'failed' ? 'Copy failed. The text is selected: press Ctrl+C or Cmd+C.' : null}
      </p>
    </div>
  );
}
