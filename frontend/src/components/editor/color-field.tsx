'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Colour picker plus a hex box. Only valid colours are sent upward, so a half-typed value never reaches the form. */
export function ColorField({ id, value, onChange }: { id: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick a colour"
        value={HEX.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-input p-1"
      />
      <Input
        id={id}
        value={text}
        maxLength={7}
        spellCheck={false}
        aria-invalid={!HEX.test(text)}
        className="font-mono uppercase"
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
          setText(v);
          if (HEX.test(v)) onChange(v.toLowerCase());
        }}
        onBlur={() => setText(value)}
      />
    </div>
  );
}
