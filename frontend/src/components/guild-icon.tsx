import { cn, initials } from '@/lib/utils';

export function GuildIcon({ name, iconUrl, className }: { name: string; iconUrl: string | null; className?: string }) {
  return iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={iconUrl} alt="" referrerPolicy="no-referrer" className={cn('size-12 rounded-2xl object-cover', className)} />
  ) : (
    <div aria-hidden className={cn('grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/40 to-cyan-400/30 text-sm font-semibold', className)}>
      {initials(name)}
    </div>
  );
}
