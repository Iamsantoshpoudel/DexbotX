import { PLACEHOLDERS } from '@/lib/placeholders';

export function PlaceholderChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Insert a variable">
      {PLACEHOLDERS.map((p) => (
        <button
          key={p.key}
          type="button"
          title={p.hint}
          onClick={() => onInsert(p.label)}
          className="rounded-md border border-border bg-input px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
