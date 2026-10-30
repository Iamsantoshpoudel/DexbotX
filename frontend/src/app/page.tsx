import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { CardMock } from '@/components/preview/card-mock';
import { BreadcrumbStructuredData, FaqStructuredData, SiteStructuredData } from '@/components/seo/json-ld';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { FAQS, HOME_SEO, createPageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

export const metadata: Metadata = createPageMetadata({
  path: '/',
  title: HOME_SEO.title,
  description: HOME_SEO.description,
  keywords: HOME_SEO.keywords,
});

export const dynamic = 'force-static';

const FEATURES = [
  {
    name: 'Moderation',
    description: 'Manage Discord moderation alongside your server’s other automation. DexBotX brings moderation tools into the same bot and dashboard as member onboarding and anti-spam.',
    href: '/features/moderation',
  },
  {
    name: 'Welcome and Goodbye',
    description: 'Welcome new members with a message and personalized card, and configure a separate goodbye for departures. Choose channels and tailor the copy in the dashboard.',
    href: '/features/welcome-bot',
  },
  {
    name: 'Auto Roles',
    description: 'Organize onboarding with automatic role management. Review role options in the dashboard and check Discord permissions so each role fits your community.',
    href: '/features/auto-roles',
  },
  {
    name: 'Anti-Spam',
    description: 'Add anti-spam automation to your server toolkit. Keep it alongside your moderation setup and review the controls available for your server in the dashboard.',
    href: '/features/moderation',
  },
  {
    name: 'Social Notifications',
    description: 'Bring creator updates into Discord with social notifications, including YouTube and Kick. Choose an appropriate channel and review available provider settings.',
    href: '/features/youtube-notifications',
  },
  {
    name: 'AI Auto Chat',
    description: 'Explore AI auto chat as part of the wider DexBotX feature set. Set expectations with your community and check the dashboard for current configuration options.',
    href: '/features/ai-chat',
  },
  {
    name: 'Web Dashboard',
    description: 'Configure server features in a visual dashboard instead of memorizing setup commands. Authorized managers can review settings for servers they can manage.',
    href: '/commands',
  },
  {
    name: 'Open Source and Free',
    description: 'DexBotX is a free, open-source public Discord bot. Anyone can invite it, and the project source is linked from the site for community review.',
    href: '/about',
  },
  {
    name: 'Fast and Reliable',
    description: 'DexBotX is built for responsive server automation, with cached settings and controlled image rendering. Use one bot for multiple everyday community tasks.',
    href: '/about',
  },
] as const;

const HOME_FAQS = FAQS.slice(0, 8);

export default function Home() {
  return (
    <>
      <SiteStructuredData />
      <BreadcrumbStructuredData items={[{ name: 'Home', path: '/' }]} />
      <FaqStructuredData items={HOME_FAQS} />
      <PublicSiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              Free · open source · public Discord bot
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              DexBotX Discord Bot
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Free and open source, DexBotX brings anti-spam, social notifications, AI auto chat, auto roles, welcome and goodbye, and moderation tools together with easy web dashboard setup.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/api/invite" className={cn(buttonVariants({ size: 'lg' }))}>
                Add to Discord
              </a>
              <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg', variant: 'ghost' }))}>
                Open Dashboard
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Built by {SITE.creator}. <Link className="text-primary underline underline-offset-4" href="/about">Learn about DexBotX</Link>.
            </p>
          </div>

          <div className="fade-up space-y-4 [animation-delay:120ms]">
            
            <CardMock />
            <div className="grid grid-cols-2 gap-4">
              <CardMock style="sunset" title="Goodbye" name="Member" subtitle="Thanks for being here" accent="#fb923c" members="Goodbye message" />
              <CardMock style="neon" title="Welcome" name="New member" subtitle="Find your way around" accent="#22d3ee" members="Welcome message" />
            </div>
          </div>
        </section>

        <section aria-labelledby="public-guides" className="border-y border-border/70 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="public-guides" className="text-3xl font-semibold tracking-tight">Explore DexBotX</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Learn about the bot, how its moderation commands work, and where to find setup and privacy information.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <li><Link className="font-medium text-primary underline-offset-4 hover:underline" href="/features">Explore all DexBotX features</Link></li>
              <li><Link className="font-medium text-primary underline-offset-4 hover:underline" href="/commands">Read command permissions and examples</Link></li>
              <li><Link className="font-medium text-primary underline-offset-4 hover:underline" href="/faq">Get answers in the DexBotX FAQ</Link></li>
              <li><Link className="font-medium text-primary underline-offset-4 hover:underline" href="/about">Meet the project and its maintainer</Link></li>
            </ul>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-6xl p-5 px-4 pb-20 sm:px-6">
          <div className="max-w-3xl">
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight">Discord automation for everyday server needs</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              DexBotX brings community management tools together. Explore a feature to see how it fits into your server setup.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ name, description, href }) => (
              <Card key={name} className="p-5">
                <h3 className="font-semibold">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                <Link href={href} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Explore {name.toLowerCase()}
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-to-add" aria-labelledby="how-to-add-heading" className="border-y border-border/70 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
            <h2 id="how-to-add-heading" className="text-3xl font-semibold tracking-tight">How to add DexBotX to your Discord server</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              <li className="rounded-xl border border-border bg-background p-5">
                <h3 className="font-semibold">1. Invite the bot</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose Add to Discord and select a server where you have permission to add bots. Review the permissions Discord displays before authorizing.</p>
              </li>
              <li className="rounded-xl border border-border bg-background p-5">
                <h3 className="font-semibold">2. Sign in to the dashboard</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Open the dashboard and log in with Discord. Select a server that you own or can manage to view its configuration.</p>
              </li>
              <li className="rounded-xl border border-border bg-background p-5">
                <h3 className="font-semibold">3. Configure your features</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Set up welcome messages and review other available options, such as roles, moderation, and social notifications. Check permissions before enabling automation.</p>
              </li>
            </ol>
            <p className="mt-6 text-sm text-muted-foreground">
              Need details? Read the <Link className="text-primary underline underline-offset-4" href="/commands">DexBotX dashboard and setup guide</Link> or visit the <Link className="text-primary underline underline-offset-4" href="/faq">FAQ</Link>.
            </p>
          </div>
        </section>

        <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="max-w-3xl">
            <h2 id="why-heading" className="text-3xl font-semibold tracking-tight">Why choose DexBotX?</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              For communities that want several everyday tools together, DexBotX combines a dashboard-led setup with a free, public, open-source bot. Choose the features that suit your server and keep the configuration in one place.
            </p>
          </div>
          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">A qualitative comparison of DexBotX and managing separate tools manually</caption>
              <thead className="bg-card">
                <tr>
                  <th scope="col" className="p-4 font-semibold">Setup consideration</th>
                  <th scope="col" className="p-4 font-semibold">DexBotX</th>
                  <th scope="col" className="p-4 font-semibold">Separate tools or manual setup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <th scope="row" className="p-4 font-medium text-foreground">Feature access</th>
                  <td className="p-4">One bot for multiple server automation needs</td>
                  <td className="p-4">Each task may require its own workflow or service</td>
                </tr>
                <tr>
                  <th scope="row" className="p-4 font-medium text-foreground">Configuration</th>
                  <td className="p-4">Visual web dashboard for server settings</td>
                  <td className="p-4">Settings can be spread across different interfaces</td>
                </tr>
                <tr>
                  <th scope="row" className="p-4 font-medium text-foreground">Access and source</th>
                  <td className="p-4">Free, public, and open source</td>
                  <td className="p-4">Availability and licensing vary by tool</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">This is a general workflow comparison, not a claim about a specific competing bot.</p>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-3xl px-4 p-20 sm:px-6">
          <h2 id="faq-heading" className="text-3xl font-semibold tracking-tight">DexBotX Discord bot questions</h2>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card/80">
            {HOME_FAQS.map(({ question, answer }) => (
              <details key={question} className="group px-5 py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="font-medium">{question}</span>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Find more answers on the <Link className="text-primary underline underline-offset-4" href="/faq">complete DexBotX FAQ page</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
