import { Sparkles } from 'lucide-react';
import { gradientFor } from '@/lib/image-styles';
import type { Preset } from '@/lib/types';
import { Skeleton } from '@/components/ui/misc';

export function PresetsBar({ presets, onApply }: { presets: Preset[] | undefined; onApply: (p: Preset) => void }) {
  if (!presets) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-44 shrink-0" />
        ))}
      </div>
    );
  }
  return (
    <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {presets.map((p) => (
        <li key={p.id} className="snap-start">
          <button
            type="button"
            onClick={() => onApply(p)}
            className="group flex h-full w-48 shrink-0 flex-col gap-2 rounded-xl border border-border bg-input p-2.5 text-left transition-colors hover:border-primary/60"
          >
            <span
              className="grid h-12 w-full place-items-center rounded-lg"
              style={{ background: p.config.image.enabled ? gradientFor(p.config.image.style) : 'linear-gradient(135deg,#1b1e25,#2a2d37)' }}
            >
              <Sparkles className="size-4 text-white/70 transition-transform group-hover:scale-125" />
            </span>
            <span className="text-sm font-medium leading-tight">{p.name}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{p.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
