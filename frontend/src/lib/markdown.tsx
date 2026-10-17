import { Fragment, type ReactNode } from 'react';

/**
 * A small subset of Discord markdown for the preview: **bold**, *italic*, __underline__, ~~strike~~,
 * `code`, backslash escapes, line breaks and <@id> mentions. Everything is rendered as React nodes
 * (never as HTML), so user text can't inject markup.
 */
const TOKEN =
  /\\([\\*_~`|>#\-[\]()])|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*(.+?)\*|_(.+?)_|`([^`\n]+)`|<@(\d+)>|(\n)/gs;

export function renderMarkdown(text: string, mentionLabel: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${depth}-${i++}`;
    const inner = (s: string) => renderMarkdown(s, mentionLabel, depth + 1);
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] !== undefined) out.push(<strong key={key}>{inner(m[2])}</strong>);
    else if (m[3] !== undefined) out.push(<u key={key}>{inner(m[3])}</u>);
    else if (m[4] !== undefined) out.push(<s key={key}>{inner(m[4])}</s>);
    else if (m[5] !== undefined || m[6] !== undefined) out.push(<em key={key}>{inner((m[5] ?? m[6]) as string)}</em>);
    else if (m[7] !== undefined)
      out.push(
        <code key={key} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em]">
          {m[7]}
        </code>,
      );
    else if (m[8] !== undefined)
      out.push(
        <span key={key} className="rounded bg-[#5865f2]/30 px-1 font-medium text-[#c9d1ff]">
          @{mentionLabel}
        </span>,
      );
    else out.push(<br key={key} />);
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, idx) => (typeof n === 'string' ? <Fragment key={`t${depth}-${idx}`}>{n}</Fragment> : n));
}
