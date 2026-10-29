import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { BreadcrumbStructuredData } from '@/components/seo/json-ld';
import { PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({ path: '/commands', ...PUBLIC_PAGE_SEO.commands });

export default function CommandsPage() {
  return (
    <>
      <BreadcrumbStructuredData items={[{ name: 'Home', path: '/' }, { name: 'Commands and setup', path: '/commands' }]} />
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link className="underline-offset-4 hover:underline" href="/">Home</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page">Commands and setup</span>
        </nav>
        <article className="mt-8 space-y-7 leading-7 text-muted-foreground">
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            DexBotX commands and dashboard setup guide
          </h1>
          <p>
            DexBotX uses a web dashboard for routine server configuration, so you do not need to memorize a list of commands to set up welcome messages and member cards. Sign in with Discord, choose a server you can manage, and use the visual settings available for that server. This page explains the setup workflow without inventing slash-command names that may not be available in every deployment.
          </p>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Add the bot and open the dashboard</h2>
            <ol className="mt-3 list-decimal space-y-3 pl-6">
              <li>Use the <a className="text-primary underline underline-offset-4" href="/api/invite">Add to Discord</a> link and select a server where you have permission to add a bot.</li>
              <li>Review the permissions shown by Discord and authorize the installation for the server you selected.</li>
              <li>Open the <Link className="text-primary underline underline-offset-4" href="/dashboard">DexBotX dashboard</Link> and sign in with Discord.</li>
              <li>Select the server you want to configure. The dashboard checks your access before showing server settings.</li>
            </ol>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Configure welcome and goodbye messages</h2>
            <p className="mt-3">
              Open the welcome settings to choose a destination channel and edit the message. Available text variables can help personalize a greeting, and the card editor provides styles and a preview so you can review the design before saving it. Welcome and goodbye messages have independent settings, allowing a server to use a separate channel or tone for departures.
            </p>
            <p className="mt-3">
              For a step-by-step explanation of the feature, read the <Link className="text-primary underline underline-offset-4" href="/features/welcome-bot">Discord welcome bot guide</Link>. Keep messages concise, give new members a useful next step, and confirm the selected channel is visible to the audience you intend.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Explore other bot settings</h2>
            <p className="mt-3">
              DexBotX is an all-in-one bot with product features including moderation, anti-spam, auto roles, social notifications for YouTube and Kick, and AI auto chat. The exact controls available can depend on the current deployment and server configuration. Use the dashboard as the source of truth for the settings available to your account rather than relying on a command list copied from another version.
            </p>
            <p className="mt-3">
              Learn about <Link className="text-primary underline underline-offset-4" href="/features/moderation">Discord moderation</Link>, <Link className="text-primary underline underline-offset-4" href="/features/auto-roles">automatic role management</Link>, <Link className="text-primary underline underline-offset-4" href="/features/youtube-notifications">YouTube and social notifications</Link>, and <Link className="text-primary underline underline-offset-4" href="/features/ai-chat">AI auto chat</Link>. Before enabling any automation, check the permissions and explain its purpose to your members.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Where to get help</h2>
            <p className="mt-3">
              The <Link className="text-primary underline underline-offset-4" href="/faq">DexBotX FAQ</Link> covers common questions about pricing, open-source access, invitations, and configuration. If you need help beyond the published guidance, visit the support server linked in the site footer. For project details and source code, see the <Link className="text-primary underline underline-offset-4" href="/about">about DexBotX page</Link> and project GitHub repository.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
