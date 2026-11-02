import { Link, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { DataPath } from '@/components/data-path';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { db } from '../../db/db';
import { parseInviteFragment, randomMemberId, toBase64Url } from '../../domain/invite';
import { shortHex } from '../../lib/format';

const textLink =
  'inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 md:min-h-0';

export function JoinPage() {
  const navigate = useNavigate();
  // The fragment is read once; it is removed from the address bar as soon as the member joins.
  const [parsed] = useState(() => parseInviteFragment(window.location.hash));
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const wsId = parsed.ok ? parsed.invite.wsId : null;
  const existing = useLiveQuery(
    async () => (wsId ? ((await db.workspaces.get(wsId)) ?? null) : null),
    [wsId],
  );

  if (!parsed.ok) {
    return (
      <div className="max-w-xl space-y-5">
        <h1 className="display text-4xl md:text-5xl">Join a workspace</h1>
        <Notice tone="danger" title="This invite link cannot be used">
          {parsed.message} Ask the workspace owner to send the link again, and copy all of it,
          including the part after #.
        </Notice>
        <Link to="/" className={textLink}>
          Back to your workspaces
        </Link>
      </div>
    );
  }
  const { invite } = parsed;

  async function join(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await db.workspaces.put({
      wsId: invite.wsId,
      role: 'member',
      label: `Shared workspace ${invite.wsId.slice(2, 6)}`,
      keyB64: toBase64Url(invite.key),
      memberId: randomMemberId(),
      displayName: displayName.trim(),
      ownerAddress: null,
      writerRevoked: false,
      createdAt: Date.now(),
    });
    // Drop the key from the address bar, history entry and anything that records the URL.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    await navigate({ to: '/w/$wsId', params: { wsId: invite.wsId } });
  }

  if (existing && !saving) {
    return (
      <div className="max-w-xl space-y-5">
        <h1 className="display text-4xl md:text-5xl">Join a workspace</h1>
        <Notice tone="info" title="You already joined this workspace on this device">
          You are <strong>{existing.displayName}</strong> here. Your key and name are stored in this
          browser.
        </Notice>
        <Link to="/w/$wsId" params={{ wsId: invite.wsId }} className={textLink}>
          Open the journal
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-20">
      <div className="max-w-xl space-y-8">
        <div className="space-y-3">
          <h1 className="display text-4xl md:text-5xl">Join a workspace</h1>
          <p className="text-muted-foreground">
            Workspace{' '}
            <code className="rounded-sm bg-muted px-1 py-px text-foreground">
              {shortHex(invite.wsId)}
            </code>
            . You do not need a wallet. The key from your invite link stays in this browser; Vendor
            A never receives it.
          </p>
        </div>
        <form
          onSubmit={join}
          className="space-y-5 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
        >
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
          <Button type="submit" disabled={saving || displayName.trim() === ''}>
            Join workspace
          </Button>
        </form>
      </div>
      <aside className="lg:border-l lg:border-border lg:pl-10">
        <DataPath headingId="legend-heading" />
      </aside>
    </div>
  );
}
