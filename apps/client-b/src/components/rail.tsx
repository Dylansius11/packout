import { Wordmark } from '@packout/brand';
import { useEffect, useRef, useState } from 'react';
import { networkLabel, rpcHost } from '../config/env';
import { restoreFocus } from '../lib/focus';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

export type View = 'import' | 'verify' | 'takeover' | 'continue';

export type StepState = { done: boolean; open: boolean };

const STEPS: { id: View; label: string; hint: string }[] = [
  { id: 'import', label: 'Import', hint: 'Bundle file and key' },
  { id: 'verify', label: 'Verify', hint: 'Six checks against Portaldot' },
  { id: 'takeover', label: 'Take over', hint: 'Revoke the old vendor' },
  { id: 'continue', label: 'Continue', hint: 'Write to the same workspace' },
];

/** The product's spine: where the owner is in leaving a vendor. Locked steps say nothing until they unlock. */
export function Rail({
  view,
  steps,
  hasWorkspace,
  onSelect,
  onForget,
  proofHref,
}: {
  view: View;
  steps: Record<View, StepState>;
  hasWorkspace: boolean;
  onSelect: (view: View) => void;
  onForget: () => void;
  /** Public proof page of the workspace on this device; absent until one is known. */
  proofHref?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  // The confirmation replaces the button that opened it: land on the safe choice, and come back afterwards.
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (wasConfirming.current) restoreFocus(trigger.current);
    wasConfirming.current = confirming;
  }, [confirming]);
  return (
    <aside className="flex flex-col gap-8 px-5 pt-6 pb-5 lg:sticky lg:top-0 lg:h-dvh lg:gap-14 lg:overflow-y-auto lg:px-10 lg:pt-12 lg:pb-10">
      <div className="flex items-baseline gap-x-5 text-ivory lg:block">
        <Wordmark size={17} />
        <p className="baseline depth-2 text-[12px] lg:mt-4">Restore</p>
      </div>

      <nav aria-label="Workspace steps">
        <ol className="grid grid-cols-4 gap-3 lg:grid-cols-1 lg:gap-8">
          {STEPS.map((step, position) => {
            const state = steps[step.id];
            const current = view === step.id;
            const locked = !state.open;
            // Depth is rank: the step in front is ivory and widest, finished steps recede to ash, locked to smoke.
            const rank = current ? 'text-ivory' : locked ? 'text-smoke' : 'text-ash';
            return (
              <li key={step.id} className="min-w-0">
                <button
                  type="button"
                  disabled={locked}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onSelect(step.id)}
                  className={cn(
                    'group grid w-full gap-x-4 gap-y-1 text-left transition-colors duration-150 lg:grid-cols-[2rem_1fr]',
                    rank,
                    locked ? 'cursor-not-allowed' : 'hover:text-ivory',
                  )}
                >
                  <span
                    aria-hidden
                    className="baseline tabular text-[10px] text-smoke lg:pt-[0.3em] lg:text-[12px]"
                  >
                    0{position + 1}
                  </span>
                  <span className="block min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span
                        className={cn(
                          'baseline text-[11px] transition-[letter-spacing] duration-150 lg:text-[15px]',
                          current
                            ? 'tracking-[0.12em] lg:tracking-[0.16em]'
                            : 'tracking-[0.06em] group-hover:tracking-[0.1em] lg:tracking-[0.1em] lg:group-hover:tracking-[0.16em]',
                          locked && 'lg:tracking-[0.06em]',
                        )}
                      >
                        {step.label}
                        <span className="sr-only">
                          {state.done ? ', done' : state.open ? '' : ', locked'}
                        </span>
                      </span>
                      {state.done || locked ? (
                        <span
                          aria-hidden
                          className={cn(
                            'baseline text-[10px] tracking-[0.1em] lg:text-[11px]',
                            state.done ? 'text-ash' : 'text-smoke',
                          )}
                        >
                          {state.done ? 'Done' : 'Locked'}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'mt-1.5 hidden text-[15px] leading-snug lg:block',
                        current ? 'text-ash' : 'text-smoke',
                      )}
                    >
                      {step.hint}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-auto space-y-4">
        <p className="baseline depth-2 text-[11px]">
          {networkLabel}
          <br className="hidden lg:inline" />
          <span className="lg:hidden"> · </span>
          <span className="hash normal-case tracking-[0.03em]">{rpcHost}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 lg:flex-col lg:items-start">
          {proofHref ? (
            <a href={proofHref} className="ghost-link block w-fit text-[12px]">
              Public proof page
            </a>
          ) : null}
          {hasWorkspace ? (
            confirming ? (
              <div className="max-w-[28ch] space-y-3" role="alert">
                <p className="text-[15px] leading-snug text-ivory">
                  Removes the workspace and its key from this browser. Portaldot is not touched; you
                  can import the bundle again.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setConfirming(false);
                      onForget();
                    }}
                  >
                    Forget it
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    ref={cancel}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                ref={trigger}
                size="sm"
                variant="ghost"
                className="h-auto -ml-1 whitespace-normal text-left leading-snug"
                onClick={() => setConfirming(true)}
              >
                Forget this workspace on this device
              </Button>
            )
          ) : null}
        </div>
      </div>
    </aside>
  );
}
