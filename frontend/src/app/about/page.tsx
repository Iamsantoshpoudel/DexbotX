import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { PublicBreadcrumbs } from '@/components/seo/public-page';
import { PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = createPageMetadata({ path: '/about', ...PUBLIC_PAGE_SEO.about });

export default function AboutPage() {
  return (
    <>
      <PublicSiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <PublicBreadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'About DexBotX', path: '/about' }]} />
        <article className="mt-8 space-y-8 leading-7 text-muted-foreground">
          <header>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              About DexBotX and its developer, DexGameX
            </h1>
            <p className="mt-5">
              DexGameX is the developer and maintainer of DexBotX, a free, open-source Discord bot project. DexBotX brings server configuration and moderation tools together with a web dashboard for community managers.
            </p>
          </header>

          <section aria-labelledby="project">
            <h2 id="project" className="text-2xl font-semibold text-foreground">The project</h2>
            <p className="mt-3">
              DexBotX includes welcome and goodbye messages, member cards, and Discord moderation commands, alongside its broader feature set for dashboard configuration and community automation. The project is public and its source is available on GitHub.
            </p>
            <p className="mt-3">
              Explore the <Link className="text-primary underline underline-offset-4" href="/features">DexBotX feature list</Link>, check the <Link className="text-primary underline underline-offset-4" href="/commands">moderation command reference</Link>, or read the <Link className="text-primary underline underline-offset-4" href="/faq">frequently asked questions</Link>.
            </p>
          </section>

          <section aria-labelledby="connect">
            <h2 id="connect" className="text-2xl font-semibold text-foreground">Project links and contact</h2>
            <p className="mt-3">
              For source code and project questions, contact DexGameX through the GitHub repository. For user support and community discussion, join the DexBotX Discord server.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              <li>
                <a className="text-primary underline underline-offset-4" href={SITE.githubUrl} target="_blank" rel="me noopener noreferrer">
                  DexBotX source on GitHub
                </a>
              </li>
              <li>
                <a className="text-primary underline underline-offset-4" href={SITE.discordSupportUrl} target="_blank" rel="noopener noreferrer">
                  DexBotX support Discord
                </a>
              </li>
              {SITE.youtubeProfileUrl && (
                <li>
                  <a className="text-primary underline underline-offset-4" href={SITE.youtubeProfileUrl} target="_blank" rel="me noopener noreferrer">
                    DexGameX on YouTube
                  </a>
                </li>
              )}
            </ul>
            {!SITE.youtubeProfileUrl && (
              <p className="mt-4 text-sm">
                A YouTube profile link will appear here when the project configures its official channel URL.
              </p>
            )}
          </section>

          <p>
            DexBotX is an independent project and is not affiliated with or endorsed by Discord Inc. See the <Link className="text-primary underline underline-offset-4" href="/privacy">privacy policy</Link> and <Link className="text-primary underline underline-offset-4" href="/terms">terms of service</Link>.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
