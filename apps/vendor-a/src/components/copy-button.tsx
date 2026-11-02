import { Check, Copy } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

/** Copies text and says so. If the browser refuses, it says that instead of pretending. */
export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className={className} onClick={copy}>
        {state === 'copied' ? (
          <Check size={16} weight="bold" className="chip-in text-success" aria-hidden />
        ) : (
          <Copy size={16} aria-hidden />
        )}
        {label}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {state === 'copied'
          ? 'Copied'
          : state === 'failed'
            ? 'Copy was blocked by the browser. Select the text and copy it by hand.'
            : ''}
      </span>
    </span>
  );
}
