import type { Metadata } from 'next';
import { BreadcrumbStructuredData } from '@/components/seo/json-ld';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { PUBLIC_PAGE_SEO, createPageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({ path: '/terms', ...PUBLIC_PAGE_SEO.terms });

export default function TermsPage() {
  return (
    <>
      <BreadcrumbStructuredData items={[{ name: 'Home', path: '/' }, { name: 'Terms of Service', path: '/terms' }]} />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Effective October 19, 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-medium text-foreground">Using DexBotX</h2>
            <p className="mt-2">
              DexBotX provides a Discord bot and dashboard for configuring welcome and goodbye messages. By using the
              service, you agree to these terms and to follow Discord&apos;s applicable terms and policies.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Your responsibilities</h2>
            <p className="mt-2">
              You must have permission to manage the Discord servers you configure. You are responsible for the
              message text, images, channel choices, and other content you submit, and for ensuring that you have the
              rights to use that content. Do not use DexBotX to violate laws, Discord rules, or other people&apos;s rights,
              or to disrupt the service.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Availability and changes</h2>
            <p className="mt-2">
              DexBotX is provided without a guarantee of uninterrupted availability. Features may change, be suspended,
              or be discontinued. We may restrict access when necessary to protect the service, users, or Discord
              communities.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Third-party services</h2>
            <p className="mt-2">
              Discord is a separate service governed by its own terms and policies. DexBotX is not affiliated with or
              endorsed by Discord Inc. Your use of Discord remains subject to Discord&apos;s terms.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Disclaimer</h2>
            <p className="mt-2">
              To the extent permitted by law, DexBotX is provided “as is” and “as available,” without warranties of any
              kind. Nothing in these terms excludes rights or remedies that cannot lawfully be excluded.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Changes and contact</h2>
            <p className="mt-2">
              These terms may be updated as the service changes. Questions about them can be directed to{' '}
              <a className="text-primary underline underline-offset-4" href={SITE.githubUrl} target="_blank" rel="noopener noreferrer">
                the project maintainer on GitHub
              </a>
              . Please do not post private account or server information publicly.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
