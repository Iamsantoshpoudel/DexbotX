import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site-footer';
import { PublicSiteHeader } from '@/components/public-site-header';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: { absolute: 'DexBotX: Page Not Found' },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <PublicSiteHeader />
      <main className="mx-auto grid min-h-[65dvh] max-w-md place-items-center px-6 text-center">
        <div>
          <p className="font-mono text-sm text-primary">404</p>
          <h1 className="mt-2 text-2xl font-semibold">This page wandered off</h1>
          <p className="mt-2 text-sm text-muted-foreground">The link may be wrong, or the page no longer exists.</p>
          <Link href="/" className={cn(buttonVariants(), 'mt-6')}>
            Back to DexBotX
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
