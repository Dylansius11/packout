import { DustField } from '@packout/brand';
import { parseBundle } from '@packout/sdk';
import { ArrowRight } from '@phosphor-icons/react';
import { type DragEvent, useId, useState } from 'react';
import { FieldError } from '@/components/field-error';
import { Notice } from '@/components/notice';
import { PageHead } from '@/components/page-head';
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
    <>
      {/* The title-screen dust sits right of the form and fades to void before any text. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 -z-10 hidden lg:left-80 lg:block"
      >
        <DustField className="block h-full w-full" anchor="end" mirror intensity={0.14} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,#000_42%,transparent_92%)]" />
      </div>

      <form onSubmit={submit} className="max-w-[36rem] space-y-14" noValidate>
        <PageHead title="Restore a workspace">
          <p>
            Bring the bundle your old app exported and the workspace key. Both stay in this browser.
            Nothing is sent to the old vendor, and this app has no connection to it.
          </p>
        </PageHead>

        {hasWorkspace ? (
          <Notice title="A workspace is already on this device">
            Importing a bundle that passes every check replaces it here. History already anchored on
            Portaldot is not affected.
          </Notice>
        ) : null}

        <div>
          <p className="baseline depth-1 mb-3 text-[12px]">1. Bundle file</p>
          <label
            htmlFor={fileId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'drop-target flex cursor-pointer flex-col gap-2 px-6 py-10 [--drop-ink:var(--color-smoke)] hover:[--drop-ink:var(--color-ash)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-signal',
              dragging && '[--drop-ink:var(--color-ivory)] bg-white/[0.04]',
            )}
          >
            <span className="text-[18px] leading-snug text-ivory">
              {file ? (
                <>
                  <strong className="hash break-all font-normal text-[16px]">{file.name}</strong> is
                  ready. Drop or choose another to replace it.
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
          {fileError ? <FieldError id={`${fileId}-error`}>{fileError}</FieldError> : null}
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
            className="break-all"
            placeholder="The key, or the whole invite link"
            aria-invalid={keyError ? true : undefined}
            aria-describedby={keyError ? `${keyId}-error` : `${keyId}-hint`}
          />
          {keyError ? (
            <FieldError id={`${keyId}-error`}>{keyError}</FieldError>
          ) : (
            <p id={`${keyId}-hint`} className="mt-3 max-w-[62ch] text-[14px] text-smoke">
              The key decrypts the history on this device. It never leaves this browser.
            </p>
          )}
        </div>

        <Button type="submit">
          Check this bundle against Portaldot
          <ArrowRight size={16} aria-hidden />
        </Button>
      </form>
    </>
  );
}
