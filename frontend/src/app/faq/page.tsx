import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { BreadcrumbStructuredData, FaqStructuredData } from '@/components/seo/json-ld';
import { FAQS, PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({ path: '/faq', ...PUBLIC_PAGE_SEO.faq });

export default function FaqPage() {
  return (
    <>
      <BreadcrumbStructuredData items={[{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }]} />
      <FaqStructuredData items={FAQS} />
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link className="underline-offset-4 hover:underline" href="/">Home</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page">FAQ</span>
        </nav>
        <article className="mt-8">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">DexBotX Discord Bot FAQ</h1>
          <p className="mt-5 max-w-3xl leading-7 text-muted-foreground">
            Find practical answers about the free, open-source DexBotX Discord bot: how to invite it, where to configure server features, and what the dashboard is for. If you are new to the project, start with the <Link className="text-primary underline underline-offset-4" href="/commands">dashboard setup guide</Link> or visit the <Link className="text-primary underline underline-offset-4" href="/about">about page</Link>.
          </p>
          <section className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card/80" aria-label="Frequently asked questions">
            {FAQS.map(({ question, answer }) => (
              <details key={question} className="group px-5 py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  <h2 className="text-base font-medium">{question}</h2>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{answer}</p>
              </details>
            ))}
          </section>
          <section className="mt-10 space-y-4 leading-7 text-muted-foreground">
            <h2 className="text-2xl font-semibold text-foreground">More DexBotX setup help</h2>
            <p>
              DexBotX uses a dashboard for server configuration. After adding the bot, sign in with Discord and select a server you are allowed to manage. The controls shown in the dashboard are the best place to confirm current availability, since features and their options can change as the project develops.
            </p>
            <p>
              Explore the guides for <Link className="text-primary underline underline-offset-4" href="/features/moderation">moderation</Link>, <Link className="text-primary underline underline-offset-4" href="/features/welcome-bot">welcome and goodbye messages</Link>, <Link className="text-primary underline underline-offset-4" href="/features/auto-roles">auto roles</Link>, <Link className="text-primary underline underline-offset-4" href="/features/youtube-notifications">social notifications</Link>, and <Link className="text-primary underline underline-offset-4" href="/features/ai-chat">AI auto chat</Link>. You can also ask for assistance in the support Discord server or review the source on GitHub through the site footer.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
