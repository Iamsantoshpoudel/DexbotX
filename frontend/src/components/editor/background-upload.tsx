'use client';

import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ALLOWED_BACKGROUND_TYPES, checkBackgroundFile } from '@/lib/background-file';
import { errorMessage, errorStatus, isRateLimited } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useUploadBackgroundMutation } from '@/store/api';

interface Props {
  guildId: string;
  /** Currently saved/draft reference, or null when no custom background is set. */
  path: string | null;
  onChange: (path: string | null) => void;
}

export function BackgroundUpload({ guildId, path, onChange }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, { isLoading }] = useUploadBackgroundMutation();
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    const problem = checkBackgroundFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      const { path: next } = await upload({ guildId, file }).unwrap();
      onChange(next);
      toast.success('Background uploaded. Save to keep it.');
    } catch (e) {
      // 429 already produced a toast in the shared baseQuery.
      if (isRateLimited(e)) return;
      const message = errorMessage(e, 'Upload failed. Try again.');
      if (errorStatus(e) === 400 && /not enabled/i.test(message)) setUnavailable(true);
      setError(message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files[0]);
  }

  if (unavailable) {
    return <p className="text-sm text-muted-foreground">Custom backgrounds are not enabled on this server.</p>;
  }

  return (
    <div className="space-y-2">
      {path ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-input px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="font-medium">Custom background in use</p>
            <p className="text-xs text-muted-foreground">It replaces the server banner and the style gradient. See it in the live preview.</p>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={() => onChange(null)} disabled={isLoading}>
            <Trash2 /> Remove
          </Button>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-primary/40',
          dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong',
          isLoading && 'pointer-events-none opacity-60',
        )}
      >
        {isLoading ? <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> : <ImagePlus className="size-5 text-muted-foreground" aria-hidden />}
        <span className="font-medium">{isLoading ? 'Uploading…' : path ? 'Replace background' : 'Upload a background'}</span>
        <span className="text-xs text-muted-foreground">Drop an image here or click to browse. PNG, JPEG or WebP, up to 2 MB.</span>
        <input id={inputId} ref={inputRef} type="file" accept={ALLOWED_BACKGROUND_TYPES.join(',')} className="sr-only" onChange={(e) => void handle(e.target.files?.[0])} disabled={isLoading} />
      </label>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
