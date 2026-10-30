import Link from 'next/link';
import { Logo } from '@/components/logo';
import { FEATURE_PAGES } from '@/lib/seo';
import { SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_2fr]">
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
        <div className="border-t border-border pt-4 text-xs text-muted-foreground md:col-span-2">
          Made by {SITE.creator}. Not affiliated with Discord Inc.
        </div>
      </div>
    </footer>
  );
}
