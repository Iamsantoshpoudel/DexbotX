import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeFeatureSection } from '@/components/home/feature-section';
import { HomeHero } from '@/components/home/hero';
import { SiteFooter } from '@/components/site-footer';
import { BreadcrumbStructuredData, SiteStructuredData } from '@/components/seo/json-ld';
import { HOME_SEO, createPageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  path: '/',
  title: HOME_SEO.title,
  description: HOME_SEO.description,
  keywords: HOME_SEO.keywords,
});

export const dynamic = 'force-dynamic';

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
    name: '24/7 Music (Planned)',
    description: '24/7 music with custom playlists is planned and is not available in the current release.',
    href: '/features',
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
] as const;

type HomePageProps = {
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const authMessages: Record<string, { message: string; href: string; action: string }> = {
    access_denied: {
      message: 'Discord sign-in was cancelled. You can try again whenever you’re ready.',
      href: '/api/auth/login?returnTo=/dashboard',
      action: 'Log in with Discord',
    },
    login_failed: {
      message: 'Discord sign-in could not be completed. Please try again.',
      href: '/api/auth/login?returnTo=/dashboard',
      action: 'Try signing in again',
    },
    bot_invite_cancelled: {
      message: 'The bot invite was cancelled. DexBotX was not added to a server.',
      href: '/api/invite',
      action: 'Try the invite again',
    },
    bot_invite_failed: {
      message: 'The bot invite could not be completed. Please try again.',
      href: '/api/invite',
      action: 'Try the invite again',
    },
  };
  const authMessage = error ? authMessages[error] : undefined;
  const inviteNotice = notice === 'bot_added_login_required';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'DexBotX Discord Bot',
            alternateName: ['DexBotX', 'Dex Bot X'],
            url: 'https://dexbotx.vercel.app/',
          }),
        }}
      />
      <SiteStructuredData />
      <BreadcrumbStructuredData items={[{ name: 'Home', path: '/' }]} />
      <main className="relative isolate overflow-hidden bg-background">
        {(authMessage || inviteNotice) && (
          <div
            role={authMessage ? 'alert' : 'status'}
            className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white/85"
          >
            <p>
              {authMessage?.message ??
                'DexBotX was authorized for your server. Log in with Discord to configure it in the dashboard.'}
            </p>
            <a
              href={authMessage?.href ?? '/api/auth/login?returnTo=/dashboard'}
              className="shrink-0 font-medium text-white underline underline-offset-4 hover:text-white/75"
            >
              {authMessage?.action ?? 'Log in with Discord'}
            </a>
          </div>
        )}
        <div className="relative">
          <HomeHero creator={SITE.creator} />

          <HomeFeatureSection features={FEATURES} />

          <section id="how-to-add" aria-labelledby="how-to-add-heading" className="border-y border-white/10 bg-white/[0.025]">
            <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
              <h2 id="how-to-add-heading" className="text-3xl font-semibold tracking-tight text-white">How to add DexBotX to your Discord server</h2>
              <ol className="mt-8 grid gap-5 md:grid-cols-3">
                <li className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="font-semibold text-white">1. Invite the bot</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">Choose Add to Discord and select a server where you have permission to add bots. Review the permissions Discord displays before authorizing.</p>
                </li>
                <li className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="font-semibold text-white">2. Sign in to the dashboard</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">Open the dashboard and log in with Discord. Select a server that you own or can manage to view its configuration.</p>
                </li>
                <li className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="font-semibold text-white">3. Configure your features</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">Set up welcome messages and review other available options, such as roles, moderation, and social notifications. Check permissions before enabling automation.</p>
                </li>
              </ol>
              <p className="mt-6 text-sm text-white/65">
                Need details? Read the <Link className="text-white/80 underline underline-offset-4 hover:text-white" href="/commands">DexBotX dashboard and setup guide</Link> or visit the <Link className="text-white/80 underline underline-offset-4 hover:text-white" href="/faq">FAQ</Link>.
              </p>
            </div>
          </section>

          <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="max-w-3xl">
              <h2 id="why-heading" className="text-3xl font-semibold tracking-tight text-white">Why choose DexBotX?</h2>
              <p className="mt-3 leading-7 text-white/65">
                For communities that want several everyday tools together, DexBotX combines a dashboard-led setup with a free, public, open-source bot. Choose the features that suit your server and keep the configuration in one place.
              </p>
            </div>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[36rem] border-collapse bg-white/[0.025] text-left text-sm">
                <caption className="sr-only">A qualitative comparison of DexBotX and managing separate tools manually</caption>
                <thead className="bg-white/[0.06] text-white">
                  <tr>
                    <th scope="col" className="p-4 font-semibold">Setup consideration</th>
                    <th scope="col" className="p-4 font-semibold">DexBotX</th>
                    <th scope="col" className="p-4 font-semibold">Separate tools or manual setup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-white/65">
                  <tr>
                    <th scope="row" className="p-4 font-medium text-foreground">Feature access</th>
                    <td className="p-4">One bot for multiple server automation needs</td>
                    <td className="p-4">Each task may require its own workflow or service</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">Configuration</th>
                    <td className="p-4">Visual web dashboard for server settings</td>
                    <td className="p-4">Settings can be spread across different interfaces</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">Access and source</th>
                    <td className="p-4">Free, public, and open source</td>
                    <td className="p-4">Availability and licensing vary by tool</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-white/60">This is a general workflow comparison, not a claim about a specific competing bot.</p>
          </section>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
