import { Link, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { db } from '../../db/db';
import { parseInviteFragment, randomMemberId, toBase64Url } from '../../domain/invite';
import { shortHex } from '../../lib/format';

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
      <div className="mx-auto max-w-xl space-y-4">
        <Notice tone="danger" title="This invite link cannot be used">
          {parsed.message} Ask the workspace owner to send the link again, and copy all of it,
          including the part after #.
        </Notice>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">
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
      <div className="mx-auto max-w-xl space-y-4">
        <Notice tone="info" title="You already joined this workspace on this device">
          You are <strong>{existing.displayName}</strong> here. Your key and name are stored in this
          browser.
        </Notice>
        <Link
          to="/w/$wsId"
          params={{ wsId: invite.wsId }}
          className="text-sm text-primary underline underline-offset-2"
        >
          Open the journal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Join a workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace <code>{shortHex(invite.wsId)}</code>. You do not need a wallet. The key from
          your invite link stays in this browser; Vendor A never receives it.
        </p>
      </div>
      <form onSubmit={join} className="space-y-5">
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
        <Button type="submit" disabled={saving || displayName.trim() === ''}>
          Join workspace
        </Button>
      </form>
    </div>
  );
}
