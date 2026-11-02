import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { DataPath } from '@/components/data-path';
import { FlowSteps } from '@/components/flow-steps';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { db } from '../../db/db';
import { newSetupRecord } from '../../onboarding/setup-runner';

export function NewWorkspacePage() {
  const navigate = useNavigate();
  const [label, setLabel] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const record = newSetupRecord(label.trim(), displayName.trim());
    await db.setups.put(record);
    await navigate({ to: '/setup/$salt', params: { salt: record.salt } });
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-20">
      <div className="max-w-xl space-y-8">
        <FlowSteps current={0} />
        <div className="space-y-3">
          <h1 className="display text-4xl md:text-5xl">Create a workspace</h1>
          <p className="text-muted-foreground">
            You will be the owner. Next you connect a wallet and sign two transactions on Portaldot;
            your teammates never need one.
          </p>
        </div>
        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <div>
            <Label htmlFor="label">Workspace name</Label>
            <Input
              id="label"
              required
              maxLength={80}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              autoComplete="off"
              aria-describedby="label-hint"
            />
            <p id="label-hint" className="mt-1.5 text-xs text-muted-foreground">
              Stored on this device only. Teammates see a short workspace id instead.
            </p>
          </div>
          <div>
            <Label htmlFor="display-name">Your display name</Label>
            <Input
              id="display-name"
              required
              maxLength={64}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              aria-describedby="display-name-hint"
            />
            <p id="display-name-hint" className="mt-1.5 text-xs text-muted-foreground">
              Shown next to what you write. It is self-declared: there is no account behind it.
            </p>
          </div>
          <Button
            type="submit"
            disabled={saving || label.trim() === '' || displayName.trim() === ''}
          >
            Continue to setup
          </Button>
        </form>
      </div>
      <aside className="lg:border-l lg:border-border lg:pl-10">
        <DataPath headingId="legend-heading" />
      </aside>
    </div>
  );
}
