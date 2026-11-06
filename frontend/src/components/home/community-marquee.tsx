import Image from 'next/image';
import { BadgeCheck, UsersRound } from 'lucide-react';
import { MARQUEE_SERVERS } from '@/assets/marque_server_list';

const formatMembers = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function CommunityMarquee() {
  if (MARQUEE_SERVERS.length === 0) return null;
  const shouldScroll = MARQUEE_SERVERS.length >= 5;

  return (
    <div
      role="region"
      aria-label="Discord servers using DexBotX"
      tabIndex={0}
      className={`community-marquee-wrapper cursor-default select-none relative left-1/2 mt-12 w-screen -translate-x-1/2 py-3 sm:mt-16 ${shouldScroll ? 'overflow-hidden' : 'overflow-x-auto'}`}
      style={{
        maskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
      }}
    >
      <div className={`community-marquee-track flex w-max ${shouldScroll ? '' : 'mx-auto'}`}>
        {(shouldScroll ? [0, 1] : [0]).map((group) => (
          <div key={group} aria-hidden={group === 1 || undefined} className={`flex shrink-0 gap-3 pr-3 ${!shouldScroll ? 'justify-center' : ''}`}>
            {MARQUEE_SERVERS.map(({ name, icon, members, verified }) => (
              <div
                key={`${group}-${name}`}
                className="flex h-16 w-64 items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
              >
                <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold text-white/80">
                  {icon ? (
                    <Image
                      src={icon}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      unoptimized={icon.src.endsWith('.gif')}
                      className="size-11 object-cover"
                    />
                  ) : (
                    name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-sm font-semibold text-white/85">{name}</span>
                    {verified && <BadgeCheck aria-label="Verified server" className="size-4 shrink-0 text-emerald-300" />}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-white/50">
                    <UsersRound aria-hidden="true" className="size-3.5" />
                    {formatMembers.format(members)}
                    <span className="sr-only"> members</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
