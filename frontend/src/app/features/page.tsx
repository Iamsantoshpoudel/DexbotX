import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { AddToDiscordButton, PublicBreadcrumbs } from '@/components/seo/public-page';
import { PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({ path: '/features', ...PUBLIC_PAGE_SEO.features });

const CORE_FEATURES = [
  {
    name: 'Fast and reliable',
    description: 'DexBotX brings common server tools together in one bot and dashboard, with configuration designed to be straightforward for community teams.',
  },
  {
    name: 'Open source and free',
    description: 'Invite and use DexBotX without a subscription. The project source is publicly available for anyone to review.',
    href: '/about',
    linkText: 'About the open-source project',
  },
  {
    name: 'Easy web dashboard configuration',
    description: 'Sign in with Discord, choose a server you can manage, and configure available server settings in the web dashboard.',
    href: '/commands',
    linkText: 'Read the setup guide',
  },
  {
    name: 'AI auto chat',
    description: 'AI auto chat is part of the DexBotX feature set. Check the dashboard for the options currently available to your server.',
  },
  {
    name: 'Social notifications',
    description: 'Keep community members informed with social notifications. Review currently available sources and settings in the dashboard.',
  },
  {
    name: 'Anti-spam',
    description: 'Anti-spam tools are part of the bot’s community-management feature set and complement your server moderation practices.',
  },
  {
    name: 'Auto roles management',
    description: 'Use role automation to support member onboarding and server organization. Discord role permissions and hierarchy still apply.',
  },
  {
    name: 'Welcome and goodbye',
    description: 'Configure separate join and departure messages, choose channels, customize the copy and member cards, and preview changes in the dashboard.',
    href: '/features/welcome-bot',
    linkText: 'Explore welcome and goodbye messages',
  },
  {
    name: 'Moderation commands',
    description: 'Use slash commands to kick, ban, unban, timeout, or remove a timeout from a member. Discord permissions and role hierarchy are checked.',
    href: '/commands',
    linkText: 'View commands, permissions, and examples',
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <PublicSiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <PublicBreadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }]} />
        <article className="mt-8 space-y-10">
          <header>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              DexBotX features for Discord communities
            </h1>
            <p className="mt-5 max-w-3xl leading-7 text-muted-foreground">
              DexBotX is a free, open-source Discord bot with an easy web dashboard. Its core feature set brings member onboarding, moderation, and community automation into one place.
            </p>
            <div className="mt-6"><AddToDiscordButton /></div>
          </header>

          <section aria-labelledby="core-features">
            <h2 id="core-features" className="text-2xl font-semibold">Core features</h2>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2">
              {CORE_FEATURES.map(({ name, description, ...link }) => (
                <li key={name} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold">{name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  {'href' in link && (
                    <Link className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline" href={link.href}>
                      {link.linkText}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="security">
            <h2 id="security" className="text-2xl font-semibold">Permissions and privacy by design</h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 leading-7 text-muted-foreground">
              <li>The default Discord invite does not request Administrator. Review the permissions Discord displays before approving, and grant only the access needed for the features you enable.</li>
              <li>Moderation commands check both the moderator’s permission and the bot’s permission, and respect Discord’s role hierarchy.</li>
              <li>DexBotX does not request Discord’s Message Content intent or read ordinary server message text. It uses member events for join and leave features and slash-command interactions for moderation.</li>
              <li>Discord login tokens stay on the server and are encrypted before storage. The browser receives an HTTP-only session cookie.</li>
            </ul>
            <p className="mt-4 leading-7 text-muted-foreground">
              Read the <Link className="text-primary underline underline-offset-4" href="/privacy">privacy policy</Link> for information about stored account and server data, retention, and deletion requests.
            </p>
          </section>

          <section aria-labelledby="roadmap">
            <h2 id="roadmap" className="text-2xl font-semibold">More features are coming</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              The following ideas are planned and are not available in the current release: an economy feature, 24/7 music with custom playlists, and tools for server owners to upload a custom bot profile picture and banner and edit its description. Availability and timing may change; check the dashboard and project updates for release details.
            </p>
          </section>

          <nav aria-label="More DexBotX information" className="border-t border-border pt-6">
            <h2 className="text-xl font-semibold">Explore DexBotX</h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <li><Link className="text-primary underline-offset-4 hover:underline" href="/commands">Moderation command reference</Link></li>
              <li><Link className="text-primary underline-offset-4 hover:underline" href="/faq">Frequently asked questions</Link></li>
              <li><Link className="text-primary underline-offset-4 hover:underline" href="/about">About the project</Link></li>
            </ul>
          </nav>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
