import Link from 'next/link';
import { DiscordIcon } from '@/components/discord-icon';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CommunityMarquee } from '@/components/home/community-marquee';

export function HomeHero({ creator }: { creator: string }) {
  return (
    <section className="px-4 pb-20 pt-16 text-center sm:px-6 lg:pb-24 lg:pt-24">
      <div className="fade-up mx-auto max-w-4xl">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[#57F287]" />
          Free · open source · public Discord bot
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
          DexBotX Discord Bot
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/70">
          Free and open source, DexBotX brings anti-spam, social notifications, AI auto chat, auto roles, welcome and goodbye, and moderation tools together with easy web dashboard setup.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/api/invite"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'rounded-md bg-[#293241] px-6 text-white shadow-[0_8px_30px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-[#38465a] hover:shadow-[0_12px_35px_rgba(0,0,0,0.38)]',
            )}
          >
            <DiscordIcon className="size-5" />
            Invite to Discord
          </a>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ size: 'lg', variant: 'ghost' }),
              'rounded-md border border-white/15 bg-white/5 px-6 text-white hover:bg-white/10',
            )}
          >
            Open Dashboard
          </Link>
        </div>
        <p className="mt-4 text-sm text-white/60">
          Built by {creator}. <Link className="text-white/75 underline underline-offset-4 hover:text-white" href="/about">Learn about DexBotX</Link>.
        </p>
      </div>
      <CommunityMarquee />
    </section>
  );
}
