import Link from 'next/link';
import { Logo } from '@/components/logo';
import { SITE } from '@/lib/site';

const FEATURE_LINKS = [
  { href: '/features/moderation', label: 'Discord moderation bot' },
  { href: '/features/welcome-bot', label: 'Welcome and goodbye messages' },
  { href: '/features/auto-roles', label: 'Auto roles' },
  { href: '/features/youtube-notifications', label: 'YouTube and social notifications' },
  { href: '/features/ai-chat', label: 'AI auto chat' },
];

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
              {FEATURE_LINKS.map(({ href, label }) => (
                <li key={href}><Link className="underline-offset-4 hover:text-foreground hover:underline" href={href}>{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-medium">Explore</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/about">About DexBotX</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/commands">Commands and setup</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/faq">Frequently asked questions</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="font-medium">Project</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/terms">Terms of Service</Link></li>
              <li><Link className="underline-offset-4 hover:text-foreground hover:underline" href="/privacy">Privacy Policy</Link></li>
              <li><a className="underline-offset-4 hover:text-foreground hover:underline" href={SITE.githubUrl} target="_blank" rel="me noopener noreferrer">Source on GitHub</a></li>
              <li><a className="underline-offset-4 hover:text-foreground hover:underline" href={SITE.discordServerUrl} target="_blank" rel="noopener noreferrer">Discord support server</a></li>
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
