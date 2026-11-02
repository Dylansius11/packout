import { Check } from '@phosphor-icons/react';
import { cn } from '../lib/utils';

const FLOW = ['Name it', 'Set up', 'Invite'] as const;

/** Where the owner is in creating a workspace: name it, set it up on Portaldot, invite the team. */
export function FlowSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Workspace creation progress" className="flex items-center">
      {FLOW.map((label, index) => {
        const state = index < current ? 'past' : index === current ? 'current' : 'future';
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn('flex items-center', index < FLOW.length - 1 && 'flex-1')}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-200',
                  state === 'past' && 'border-primary bg-primary text-primary-foreground',
                  state === 'current' && 'border-primary bg-primary-soft text-primary',
                  state === 'future' && 'border-border-strong bg-surface text-muted-foreground',
                )}
              >
                {state === 'past' ? <Check size={12} weight="bold" /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  state === 'future' ? 'text-muted-foreground' : 'font-medium text-foreground',
                )}
              >
                {label}
              </span>
            </span>
            {index < FLOW.length - 1 ? (
              <span aria-hidden="true" className="relative mx-3 h-px flex-1 bg-border-strong">
                <span
                  className={cn(
                    'progress-fill absolute inset-0 bg-primary',
                    index < current ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
