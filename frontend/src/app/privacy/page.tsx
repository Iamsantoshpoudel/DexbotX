import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn what information DexBotX handles when you use its Discord welcome and goodbye bot, dashboard, and custom avatar cards.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website',
    url: '/privacy',
    title: 'Privacy Policy',
    description: 'Learn what information DexBotX handles when you use its Discord welcome and goodbye bot, dashboard, and custom avatar cards.',
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Effective October 19, 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-medium text-foreground">Information we handle</h2>
            <p className="mt-2">
              When you sign in with Discord, DexBotX receives your Discord user ID, username, display name, avatar
              information, and the server list and permissions needed to show servers you can manage. For servers where
              the bot is installed, the service stores server details, channel and role data used by the dashboard,
              welcome and goodbye settings, and records of setting changes. If you upload a message-card background,
              the image is stored for use with that server&apos;s configuration.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">How information is used</h2>
            <p className="mt-2">
              We use this information to authenticate you, enforce server permissions, provide dashboard features,
              deliver configured messages, keep server data synchronized, secure the service, and troubleshoot
              failures. We do not sell personal information or use it for third-party advertising.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Sessions and storage</h2>
            <p className="mt-2">
              Login sessions are stored server-side and expire automatically. The Discord access token is encrypted
              before it is stored. The browser receives an HTTP-only session cookie. We use Redis for sessions and
              short-lived caches, Supabase Postgres for configuration and server records, and Supabase Storage for
              uploaded backgrounds when that feature is configured.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Retention and your choices</h2>
            <p className="mt-2">
              Session data expires with the session, and logging out removes the session and requests token
              revocation from Discord. Server configuration and audit records may remain after the bot leaves a server
              so settings are not unexpectedly lost. You can remove DexBotX from a server; for a request to delete
              stored server data or uploaded backgrounds, contact the maintainer using the link below. Do not include
              secrets or sensitive account information in a public post.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Service providers and Discord</h2>
            <p className="mt-2">
              DexBotX relies on Discord for login and bot functionality, and on its configured hosting, database,
              cache, and file-storage providers to operate. Information is processed by those services as needed to
              provide DexBotX. Their own privacy terms also apply to your use of their services.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-foreground">Policy updates and contact</h2>
            <p className="mt-2">
              This policy may be updated when the service or its data practices change. For privacy questions or data
              deletion requests, contact{' '}
              <a className="text-primary underline underline-offset-4" href={SITE.githubUrl} target="_blank" rel="noopener noreferrer">
                the project maintainer on GitHub
              </a>
              . Please use a private contact method if available; do not publish private account or server information.
            </p>
          </section>
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/terms" className="text-primary underline underline-offset-4">Terms of Service</Link>
          {' · '}
          <Link href="/" className="text-primary underline underline-offset-4">Home</Link>
        </p>
      </main>
    </>
  );
}
