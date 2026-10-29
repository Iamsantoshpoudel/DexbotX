import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { BreadcrumbStructuredData } from '@/components/seo/json-ld';
import { PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({ path: '/about', ...PUBLIC_PAGE_SEO.about });

export default function AboutPage() {
  return (
    <>
      <BreadcrumbStructuredData items={[{ name: 'Home', path: '/' }, { name: 'About DexBotX', path: '/about' }]} />
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link className="underline-offset-4 hover:underline" href="/">Home</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page">About DexBotX</span>
        </nav>
        <article className="mt-8 space-y-7 leading-7 text-muted-foreground">
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            About DexBotX, an all-in-one Discord bot
          </h1>
          <p>
            DexBotX is a free, open-source, public Discord bot developed by dexgamex. It brings everyday server automation into one bot and one web dashboard, so community managers can organize useful features without treating each task as a separate product. Anyone can invite DexBotX to a Discord server.
          </p>
          <p>
            The project includes tools for welcoming and saying goodbye to members, moderation, anti-spam, automatic role management, social notifications such as YouTube and Kick updates, and AI auto chat. The dashboard is designed to make configuration approachable for server managers, with visual controls for settings such as welcome messages and member cards.
          </p>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Built for practical server management</h2>
            <p className="mt-3">
              A Discord community uses many small systems: an arrival message, a consistent role structure, clear moderation practices, and a place for relevant creator updates. DexBotX aims to bring these needs together while keeping the configuration available through a web dashboard. Managers can choose the features that suit their community and adjust them as the server changes.
            </p>
            <p className="mt-3">
              Automation works best when it supports people rather than replacing them. Server owners remain responsible for their rules, permissions, and the way automated features are used. Review available settings, grant appropriate bot permissions, and explain automated behavior to members where it affects their experience.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Open source and community access</h2>
            <p className="mt-3">
              DexBotX is an open-source project, and the source is available through the project&apos;s GitHub repository. Public access means a server can invite the bot without needing a private introduction. For questions or setup assistance, use the support Discord server linked in the footer.
            </p>
            <p className="mt-3">
              To start, follow the <Link className="text-primary underline underline-offset-4" href="/#how-to-add">steps to add DexBotX to a Discord server</Link>, then open the <Link className="text-primary underline underline-offset-4" href="/commands">dashboard setup guide</Link>. Explore the feature pages for <Link className="text-primary underline underline-offset-4" href="/features/moderation">moderation</Link>, <Link className="text-primary underline underline-offset-4" href="/features/welcome-bot">welcome messages</Link>, <Link className="text-primary underline underline-offset-4" href="/features/auto-roles">auto roles</Link>, <Link className="text-primary underline underline-offset-4" href="/features/youtube-notifications">social notifications</Link>, and <Link className="text-primary underline underline-offset-4" href="/features/ai-chat">AI chat</Link>.
            </p>
          </section>
          <p>
            DexBotX is developed by dexgamex and is not affiliated with or endorsed by Discord Inc. Read the <Link className="text-primary underline underline-offset-4" href="/privacy">privacy policy</Link> and <Link className="text-primary underline underline-offset-4" href="/terms">terms of service</Link> for more information about using the website.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
