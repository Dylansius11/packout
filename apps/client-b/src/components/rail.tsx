import { Check } from '@phosphor-icons/react';
import { useState } from 'react';
import { networkLabel, rpcHost } from '../config/env';
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
  return (
    <aside className="flex flex-col gap-6 border-b border-border bg-rail px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
      <div>
        <p className="text-xl font-semibold tracking-tight">Client B</p>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Independent restore
        </p>
      </div>

      <nav aria-label="Workspace steps">
        <ol className="grid grid-cols-4 gap-1 lg:grid-cols-1 lg:gap-0">
          {STEPS.map((step, position) => {
            const state = steps[step.id];
            const current = view === step.id;
            return (
              <li key={step.id} className="lg:border-l lg:border-border">
                <button
                  type="button"
                  disabled={!state.open}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onSelect(step.id)}
                  className={cn(
                    'flex w-full flex-col items-center gap-1.5 rounded-md px-1 py-2 text-center transition-colors duration-150 lg:-ml-px lg:flex-row lg:items-start lg:gap-3 lg:border-l-2 lg:border-transparent lg:rounded-none lg:px-4 lg:text-left',
                    current ? 'lg:border-primary' : 'hover:bg-raised',
                    !state.open && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'tabular grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-xs',
                      state.done && 'border-success-line bg-success-soft text-success',
                      !state.done && current && 'border-primary bg-primary text-primary-foreground',
                      !state.done && !current && 'border-input text-muted-foreground',
                    )}
                  >
                    {state.done ? <Check size={14} weight="bold" /> : position + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-xs font-medium lg:text-sm',
                        current
                          ? 'text-foreground underline decoration-primary decoration-2 underline-offset-4'
                          : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                      <span className="sr-only">
                        {state.done ? ', done' : state.open ? '' : ', locked'}
                      </span>
                    </span>
                    <span className="hidden text-xs text-muted-foreground lg:block">
                      {step.hint}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-auto space-y-3">
        <p className="hidden text-xs text-muted-foreground lg:block">
          <span className="font-mono">{networkLabel}</span>
          <br />
          <span className="font-mono">{rpcHost}</span>
        </p>
        {proofHref ? (
          <a
            href={proofHref}
            className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Public proof page
          </a>
        ) : null}
        {hasWorkspace ? (
          confirming ? (
            <div className="space-y-2 text-xs" role="alert">
              <p>
                Removes the workspace and its key from this browser. Portaldot is not touched; you
                can import the bundle again.
              </p>
              <div className="flex gap-2">
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
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="-ml-3 h-auto min-h-8 whitespace-normal py-1.5 text-left text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => setConfirming(true)}
            >
              Forget this workspace on this device
            </Button>
          )
        ) : null}
      </div>
    </aside>
  );
}
