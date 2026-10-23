import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
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
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create a workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You will be the owner. Next you connect a wallet and sign two transactions on Portaldot;
          your teammates never need one.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="label">Workspace name</Label>
          <Input
            id="label"
            required
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted-foreground">
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
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown next to what you write. It is self-declared: there is no account behind it.
          </p>
        </div>
        <Button type="submit" disabled={saving || label.trim() === '' || displayName.trim() === ''}>
          Continue to setup
        </Button>
      </form>
    </div>
  );
}
