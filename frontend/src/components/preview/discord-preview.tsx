import { Hash } from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { Skeleton } from '@/components/ui/misc';
import { renderMarkdown } from '@/lib/markdown';
import { applyPlaceholders, type PlaceholderContext } from '@/lib/placeholders';
import type { MessageConfig } from '@/lib/types';

interface Props {
  config: MessageConfig;
  ctx: PlaceholderContext;
  channelName: string | null;
  card: { url: string | null; loading: boolean; error: string | null };
}

/** Approximates how Discord shows the bot's message. Text and embed update instantly; the card comes from the server. */
export function DiscordPreview({ config, ctx, channelName, card }: Props) {
  const msg = (text: string) => applyPlaceholders(text, ctx, 'message');
  const content = config.content.trim() ? msg(config.content) : '';
  const embed = config.embed.enabled
    ? { title: msg(config.embed.title), description: msg(config.embed.description), footer: applyPlaceholders(config.embed.footer, ctx, 'image'), color: config.embed.color }
    : null;
  const showCard = config.image.enabled;
  const empty = !content && !embed && !showCard;

  const cardImage = showCard ? (
    <div className="mt-2 overflow-hidden rounded-lg" style={{ aspectRatio: '1100 / 400' }}>
      {card.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.url} alt="Preview of the card members will receive" className={`size-full object-cover transition-opacity ${card.loading ? 'opacity-60' : ''}`} />
      ) : (
        <Skeleton className="size-full rounded-lg bg-white/5" />
      )}
    </div>
  ) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#313338] text-[#dbdee1] shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-black/30 px-4 py-2.5 text-sm font-semibold text-white">
        <Hash className="size-4 text-[#80848e]" /> {channelName ?? 'choose-a-channel'}
      </div>
      <div className="flex gap-3.5 px-4 py-4">
        <LogoMark className="size-10 shrink-0" />
        <div className="min-w-0 flex-1 text-[15px] leading-[1.4]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">DexBotX</span>
            <span className="rounded bg-[#5865f2] px-1.5 text-[10px] font-semibold uppercase leading-4 text-white">App</span>
            <span className="text-xs text-[#949ba4]">Today at 12:00</span>
          </div>

          {empty && <p className="mt-1 text-sm italic text-[#949ba4]">Nothing to send. Turn on text, an embed or the image card.</p>}

          {content && <div className="mt-0.5 whitespace-pre-wrap break-words">{renderMarkdown(content, ctx.displayName)}</div>}

          {embed && (
            <div className="mt-2 max-w-[432px] rounded border-l-4 bg-[#2b2d31] p-3" style={{ borderLeftColor: embed.color }}>
              {embed.title && <div className="font-semibold text-white">{renderMarkdown(embed.title, ctx.displayName)}</div>}
              {embed.description && <div className="mt-1 whitespace-pre-wrap break-words text-sm">{renderMarkdown(embed.description, ctx.displayName)}</div>}
              {cardImage}
              {embed.footer.trim() && <div className="mt-2 text-xs text-[#949ba4]">{embed.footer}</div>}
            </div>
          )}

          {!embed && cardImage && <div className="max-w-[432px]">{cardImage}</div>}

          {card.error && showCard && <p className="mt-2 text-xs text-[#f0b232]">{card.error}</p>}
        </div>
      </div>
    </div>
  );
}
