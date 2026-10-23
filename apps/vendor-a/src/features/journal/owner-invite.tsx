import { CopyButton } from '@/components/copy-button';
import { buildInviteUrl, keyFromBase64Url } from '../../domain/invite';
import { useJournalContext } from './journal-context';

export function OwnerInvite() {
  const { workspace } = useJournalContext();
  const link = buildInviteUrl(
    window.location.origin,
    workspace.wsId,
    keyFromBase64Url(workspace.keyB64),
  );
  return (
    <section aria-labelledby="invite-heading" className="space-y-2">
      <h2 id="invite-heading" className="text-base font-semibold">
        Invite members
      </h2>
      <p className="text-sm text-muted-foreground">
        The key is in the part after #, which browsers never send to a server. Anyone with the link
        can read and write this workspace.
      </p>
      <CopyButton text={link} label="Copy invite link" />
    </section>
  );
}
