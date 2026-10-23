import Image from 'next/image';
import { cn, initials } from '@/lib/utils';

export function GuildIcon({ name, iconUrl, className }: { name: string; iconUrl: string | null; className?: string }) {
  return iconUrl ? (
    <Image
      src={iconUrl}
      alt=""
      width={48}
      height={48}
      sizes="48px"
      referrerPolicy="no-referrer"
      className={cn('size-12 rounded-2xl object-cover', className)}
    />
  ) : (
    <div aria-hidden className={cn('grid size-12 place-items-center rounded-xl bg-accent-soft text-sm font-semibold text-primary', className)}>
      {initials(name)}
    </div>
  );
}
