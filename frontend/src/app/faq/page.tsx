import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { FaqStructuredData } from '@/components/seo/json-ld';
import { PublicBreadcrumbs } from '@/components/seo/public-page';
import { FAQS, PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({ path: '/faq', ...PUBLIC_PAGE_SEO.faq });

export default function FaqPage() {
  return (
    <>
      <FaqStructuredData items={FAQS} />
      <PublicSiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <PublicBreadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }]} />
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
              Explore <Link className="text-primary underline underline-offset-4" href="/features">all DexBotX features</Link>, see <Link className="text-primary underline underline-offset-4" href="/commands">moderation command examples</Link>, or ask for help in the support Discord server. The <Link className="text-primary underline underline-offset-4" href="/about">About page</Link> links to project source and contact options.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
