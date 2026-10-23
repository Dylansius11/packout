import { parseBundle } from '@packout/sdk';
import { FileArrowUp } from '@phosphor-icons/react';
import { type DragEvent, useId, useState } from 'react';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { parseKeyInput } from '../../domain/key-input';

export type ImportDraft = { fileName: string; text: string; key: Uint8Array };

type PickedFile = { name: string; text: string };

/** Step 1: the two things an owner kept from the old app, a bundle file and the workspace key. */
export function ImportScreen({
  hasWorkspace,
  onSubmit,
}: {
  hasWorkspace: boolean;
  onSubmit: (draft: ImportDraft) => void;
}) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [keyText, setKeyText] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileId = useId();
  const keyId = useId();

  async function pick(picked: File | undefined) {
    if (!picked) return;
    setFileError(null);
    setFile(null);
    let text: string;
    try {
      text = await picked.text();
    } catch {
      setFileError(
        `${picked.name} could not be read. Check that the file still exists and try again.`,
      );
      return;
    }
    if (text.trim() === '') {
      setFileError(`${picked.name} is empty. Choose the bundle.json your old app exported.`);
      return;
    }
    setFile({ name: picked.name, text });
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files[0]);
  }

  function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!file) {
      setFileError('Choose the bundle file first.');
      return;
    }
    const parsed = parseKeyInput(keyText);
    if (!parsed.ok) {
      setKeyError(parsed.message);
      return;
    }
    if (parsed.wsId) {
      try {
        const bundle = parseBundle(file.text);
        if (bundle.wsId !== parsed.wsId) {
          setKeyError(
            'This invite link is for a different workspace than the bundle file. Use the key and the file from the same workspace.',
          );
          return;
        }
      } catch {
        // An unreadable bundle is reported by the verifier, with its own step and sentence.
      }
    }
    setKeyError(null);
    onSubmit({ fileName: file.name, text: file.text, key: parsed.key });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <h1 className="text-2xl font-semibold">Restore a workspace</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Bring the bundle your old app exported and the workspace key. Both stay in this browser.
          Nothing is sent to the old vendor, and this app has no connection to it.
        </p>
      </div>

      {hasWorkspace ? (
        <Notice title="A workspace is already on this device">
          Importing a bundle that passes every check replaces it here. History already anchored on
          Portaldot is not affected.
        </Notice>
      ) : null}

      <div>
        <p className="mb-1.5 text-sm font-medium">1. Bundle file</p>
        <label
          htmlFor={fileId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-input px-4 py-8 text-center transition-colors duration-150 hover:bg-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
            dragging && 'border-primary bg-surface',
          )}
        >
          <FileArrowUp size={28} aria-hidden className="text-primary" />
          <span className="text-sm">
            {file ? (
              <>
                <strong className="font-medium">{file.name}</strong> is ready. Drop or choose
                another to replace it.
              </>
            ) : (
              'Drop bundle.json here, or choose it'
            )}
          </span>
          <input
            id={fileId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-describedby={fileError ? `${fileId}-error` : undefined}
            onChange={(event) => {
              void pick(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {fileError ? (
          <p id={`${fileId}-error`} role="alert" className="mt-2 text-sm text-danger">
            {fileError}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor={keyId}>2. Workspace key or invite link</Label>
        <Textarea
          id={keyId}
          rows={3}
          value={keyText}
          onChange={(event) => {
            setKeyText(event.target.value);
            setKeyError(null);
          }}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className="break-all font-mono"
          placeholder="The key, or the whole invite link"
          aria-invalid={keyError ? true : undefined}
          aria-describedby={keyError ? `${keyId}-error` : `${keyId}-hint`}
        />
        {keyError ? (
          <p id={`${keyId}-error`} role="alert" className="mt-2 text-sm text-danger">
            {keyError}
          </p>
        ) : (
          <p id={`${keyId}-hint`} className="mt-2 text-xs text-muted-foreground">
            The key decrypts the history on this device. It never leaves this browser.
          </p>
        )}
      </div>

      <Button type="submit">Check this bundle against Portaldot</Button>
    </form>
  );
}
