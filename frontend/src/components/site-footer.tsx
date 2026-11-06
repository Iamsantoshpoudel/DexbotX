import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { FEATURE_PAGES } from '@/lib/seo';
import { SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="relative mt-[19rem] rounded-t-[2rem] border-t border-white/10 bg-background pb-12 pt-20 shadow-[0_-12px_50px_rgba(0,0,0,0.2)] sm:mt-[22rem] sm:pt-28 md:mt-[26rem]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-[2rem]"
        style={{ background: 'radial-gradient(ellipse 55% 100% at 50% 0%, rgb(88 101 242 / 0.12), transparent 100%)' }}
      />
      <div className=" pointer-events-none bg- absolute bottom-[calc(100%-3.25rem)] left-1/2 z-10 w-[min(24rem,94vw)] -translate-x-1/2 sm:bottom-[calc(100%-4.5rem)] sm:w-[28rem] md:w-[32rem]">
        <Image
          src="/assets/DiscordCharDexbotx.png"
          alt="DexBotX mascot"
          width={1022}
          height={1195}
          sizes="(max-width: 640px) 94vw, (max-width: 768px) 448px, 512px"
          loading="eager"
          className="block h-auto w-full"
        />
      </div>
      <div className="relative z-10 mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_2fr]">
        
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Free, open source Discord automation developed by {SITE.creator}.
          </p>
        </div>
        <nav aria-label="Footer" className="grid gap-6 text-sm sm:grid-cols-3">
          <div>
            <h2 className="font-medium">Features</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/features">All DexBotX features</Link></li>
              {FEATURE_PAGES.map(({ slug, name }) => (
                <li key={slug}>
                  <Link className="underline-offset-4 hover:text-foreground hover:underline" href={`/features/${slug}`}>
                    {name} for Discord
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-medium">Explore</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/">DexBotX home</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/about">About DexBotX</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/commands">Moderation commands and examples</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/faq">Frequently asked questions</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="font-medium">Project</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/terms">Terms of Service</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/privacy">Privacy Policy</Link></li>
              <li><a className="underline-offset-4 hover:text-foreground hover:underline" href={SITE.githubUrl} target="_blank" rel="me noopener noreferrer">Source on GitHub</a></li>
              <li><a className="underline-offset-4 hover:text-foreground hover:underline" href={SITE.discordSupportUrl} target="_blank" rel="noopener noreferrer">Discord support server</a></li>
              {SITE.youtubeProfileUrl && (
                <li><a className="underline-offset-4 hover:text-foreground hover:underline" href={SITE.youtubeProfileUrl} target="_blank" rel="me noopener noreferrer">DexGameX on YouTube</a></li>
              )}
            </ul>
          </div>
        </nav>
        <div className="border-t border-white/10 pt-4 text-xs text-white/55 md:col-span-2">
          Made by {SITE.creator}. Not affiliated with Discord Inc.
        </div>
      </div>
    </footer>
  );
}
