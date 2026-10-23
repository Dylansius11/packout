import { Notice } from '@/components/notice';
import type { Journal } from './use-journal';

/** Persistent, honest status of the link to Vendor A. Nothing here is decoration. */
export function WorkspaceBanners({ journal }: { journal: Journal }) {
  const { connection, workspace, unreadable } = journal;
  return (
    <div className="space-y-3">
      {workspace.writerRevoked ? (
        <Notice
          tone="danger"
          title="Vendor A can no longer write to this workspace. The owner moved it."
        >
          Writing is turned off here. Everything already on this device stays readable. Anything you
          wrote that was not anchored is marked as rejected below.
        </Notice>
      ) : null}
      {connection.connection === 'offline' ? (
        <Notice tone="warning" title="Vendor A is offline. Your changes stay on this device.">
          They are sent automatically when Vendor A is reachable again.
        </Notice>
      ) : null}
      {connection.connection === 'error' ? (
        <Notice tone="warning" title="Vendor A reported a problem">
          {connection.message}
        </Notice>
      ) : null}
      {connection.connection === 'online' && connection.view === null ? (
        <Notice tone="warning" title="Vendor A does not know this workspace yet">
          The owner has to finish setup before changes can leave this device. They stay saved here
          meanwhile.
        </Notice>
      ) : null}
      {connection.connection === 'online' &&
      connection.view?.lastError &&
      !workspace.writerRevoked ? (
        <Notice tone="warning" title="Vendor A could not anchor everything yet">
          {connection.view.lastError}
        </Notice>
      ) : null}
      {unreadable > 0 ? (
        <Notice
          tone="warning"
          title={`${unreadable} ${unreadable === 1 ? 'operation' : 'operations'} could not be read`}
        >
          This device cannot decrypt {unreadable === 1 ? 'it' : 'them'} with the workspace key, so
          {unreadable === 1 ? ' it is' : ' they are'} left out of the journal. Check that you joined
          with the owner’s original invite link.
        </Notice>
      ) : null}
    </div>
  );
}
