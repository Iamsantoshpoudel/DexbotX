import { Check } from 'lucide-react';
import { gradientFor, IMAGE_STYLES } from '@/lib/image-styles';
import type { ImageStyleId } from '@/lib/types';
import { cn } from '@/lib/utils';

export function StylePicker({ value, onChange }: { value: ImageStyleId; onChange: (id: ImageStyleId) => void }) {
  return (
    <div role="radiogroup" aria-label="Card style" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {(Object.keys(IMAGE_STYLES) as ImageStyleId[]).map((id) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn('group relative flex flex-col gap-1.5 rounded-xl border p-1.5 text-xs transition-colors', selected ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong')}
          >
            <span className="grid h-10 w-full place-items-center rounded-lg" style={{ background: gradientFor(id) }}>
              {selected && <Check className="size-4 text-white drop-shadow" />}
            </span>
            <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>{IMAGE_STYLES[id].label}</span>
          </button>
        );
      })}
    </div>
  );
}
