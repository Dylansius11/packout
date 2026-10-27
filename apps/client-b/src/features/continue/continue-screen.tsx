import type { IssueStatus, OpBody, WorkspaceOnChain } from '@packout/sdk';
import { type FormEvent, useId, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { connectedWriter } from '@/chain/wallet';
import { ChainFacts } from '@/components/chain-facts';
import { Notice } from '@/components/notice';
import { TxStatus } from '@/components/tx-status';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { WalletPanel } from '@/components/wallet-panel';
import { registryReader } from '../../chain/clients';
import type { StoredOp, WorkspaceRecord } from '../../db/types';
import type { Access } from '../../domain/gating';
import type { IssueView } from '../../domain/journal-view';
import { sessionKey } from '../../domain/storage';
import { appendOwnerOp } from '../../domain/write-op';
import { txPending, useTx } from '../../hooks/use-tx';
import { describeFailure } from '../../lib/errors';
import { useRestoreFocusWhenIdle } from '../../lib/focus';
import { ExportPanel } from '../export/export-panel';
import { IssueList, STATUS_LABEL } from '../workspace/issue-list';

type WriteFn = (body: OpBody) => Promise<boolean>;

function NewIssueForm({ write, disabled }: { write: WriteFn; disabled: boolean }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  // The submit button disables while the write runs, which drops keyboard focus: bring it back.
  useRestoreFocusWhenIdle(busy, titleRef);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === '') return;
    setBusy(true);
    try {
      const ok = await write({
        type: 'issue.create',
        body: { title: title.trim(), description: description.trim() },
      });
      if (ok) {
        setTitle('');
        setDescription('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="new-issue-heading"
      className="space-y-3 rounded-md border border-border bg-surface p-4"
    >
      <h2 id="new-issue-heading" className="text-base font-semibold">
        New issue
      </h2>
      <div>
        <Label htmlFor={titleId}>Title</Label>
        <Input
          id={titleId}
          ref={titleRef}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor={descriptionId}>Description (optional)</Label>
        <Textarea
          id={descriptionId}
          value={description}
          maxLength={5000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={disabled || title.trim() === ''}>
        Anchor issue on Portaldot
      </Button>
    </form>
  );
}

function IssueActions({
  view,
  write,
  disabled,
}: {
  view: IssueView;
  write: WriteFn;
  disabled: boolean;
}) {
  const [status, setStatus] = useState<IssueStatus>(view.issue.status);
  const [comment, setComment] = useState('');
  const statusId = useId();
  const commentId = useId();
  const [busy, setBusy] = useState<'status' | 'comment' | null>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);
  useRestoreFocusWhenIdle(busy === 'status', statusRef);
  useRestoreFocusWhenIdle(busy === 'comment', commentRef);
  async function run(kind: 'status' | 'comment', body: OpBody): Promise<boolean> {
    setBusy(kind);
    try {
      return await write(body);
    } finally {
      setBusy(null);
    }
  }
  const issueId = view.issue.id;

  return (
    <div className="grid gap-4 border-t border-border pt-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={statusId}>Status</Label>
        <div className="flex gap-2">
          <Select
            id={statusId}
            ref={statusRef}
            value={status}
            onChange={(event) => setStatus(event.target.value as IssueStatus)}
            disabled={disabled}
          >
            {(Object.keys(STATUS_LABEL) as IssueStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            disabled={disabled || status === view.issue.status}
            onClick={() =>
              void run('status', { type: 'issue.setStatus', body: { issueId, status } })
            }
          >
            Anchor status
          </Button>
        </div>
      </div>
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = comment.trim();
          if (text === '') return;
          if (await run('comment', { type: 'comment.add', body: { issueId, text } }))
            setComment('');
        }}
      >
        <Label htmlFor={commentId}>Comment</Label>
        <div className="flex gap-2">
          <Input
            id={commentId}
            ref={commentRef}
            value={comment}
            maxLength={5000}
            onChange={(event) => setComment(event.target.value)}
            disabled={disabled}
          />
          <Button type="submit" variant="outline" disabled={disabled || comment.trim() === ''}>
            Anchor comment
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Step 4: keep writing to the same workspace. Every change is encrypted here and appended by the owner wallet. */
export function ContinueScreen(props: {
  workspace: WorkspaceRecord;
  ops: StoredOp[];
  views: IssueView[];
  onChain: WorkspaceOnChain;
  action: Access;
  /** Re-checks the history against Portaldot after every attempt, so stale state shows up at once. */
  onWriteAttempt: (failure: string | null) => void;
}) {
  const { workspace, action } = props;
  const account = useAccount();
  const tx = useTx();
  const [displayName, setDisplayName] = useState(workspace.displayName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [lastWrite, setLastWrite] = useState<StoredOp | null>(null);
  const nameId = useId();
  const pending = txPending(tx.state);
  const disabled = !action.open || pending;

  const write: WriteFn = async (body) => {
    const address = account.address;
    const reader = registryReader;
    if (!address || !reader || !action.open) return false;
    const name = displayName.trim();
    if (name === '') {
      setNameError('Enter the name your writes should carry first.');
      return false;
    }
    setNameError(null);
    let failure: string | null = null;
    const result = await tx.run((progress) =>
      appendOwnerOp({
        workspace,
        displayName: name,
        key: sessionKey(workspace),
        body,
        account: address,
        reader,
        writer: () => connectedWriter(account.chainId),
        progress,
      }).catch((error: unknown) => {
        failure = describeFailure(error);
        throw error;
      }),
    );
    if (result) setLastWrite(result.stored);
    props.onWriteAttempt(failure);
    return result !== null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Keep writing</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Each change is encrypted on this device, then appended on Portaldot by your owner wallet
          as the next operation of this workspace. Nothing goes to any vendor.
        </p>
      </div>

      <ChainFacts onChain={props.onChain} registry={workspace.registry} />

      <section aria-labelledby="writer-heading" className="space-y-3">
        <h2 id="writer-heading" className="text-base font-semibold">
          Writing as
        </h2>
        <div className="max-w-sm">
          <Label htmlFor={nameId}>Your display name</Label>
          <Input
            id={nameId}
            value={displayName}
            maxLength={64}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            aria-invalid={nameError ? true : undefined}
          />
          {nameError ? (
            <p id={`${nameId}-error`} role="alert" className="mt-1.5 text-sm text-danger">
              {nameError}
            </p>
          ) : null}
        </div>
        <WalletPanel />
        {!action.open ? (
          <Notice tone={account.isConnected ? 'danger' : 'info'} title="Writing is locked">
            {action.reason}
          </Notice>
        ) : null}
      </section>

      <div aria-live="polite" className="min-h-6 space-y-1">
        <TxStatus
          state={tx.state}
          doneText={
            lastWrite ? (
              <>
                Anchored on Portaldot · #{lastWrite.index}. Encrypted on this device first; no
                vendor involved.
              </>
            ) : (
              'Anchored on Portaldot.'
            )
          }
        />
      </div>

      <NewIssueForm write={write} disabled={disabled} />

      <section aria-labelledby="issues-heading" className="space-y-3">
        <h2 id="issues-heading" className="text-lg font-semibold">
          Workspace
        </h2>
        <IssueList
          views={props.views}
          renderActions={(view) => <IssueActions view={view} write={write} disabled={disabled} />}
        />
      </section>

      <ExportPanel workspace={workspace} ops={props.ops} />
    </div>
  );
}
