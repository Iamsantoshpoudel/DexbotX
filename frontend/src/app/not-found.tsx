import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import codingGif from '@/assets/Coding.gif';
import { SiteFooter } from '@/components/site-footer';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: { absolute: 'DexBotX: Page Not Found' },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <main className="mx-auto grid min-h-[65dvh] max-w-3xl place-items-center px-6 py-12 text-center">
        <h1 className=" p-2 font-mono text-2xl font-bold tracking-widest text-primary sm:text-7xl">404</h1>
        <div className="flex flex-col items-center">
          <Image
            src={codingGif}
            alt="A character coding at a computer"
            width={codingGif.width}
            height={codingGif.height}
            sizes="(max-width: 640px) 85vw, 480px"
            loading="eager"
            unoptimized
            className="mb-6 h-auto max-h-64 w-full max-w-[480px] rounded-2xl "
          />
          <h1 className="font-mono text-2xl font-bold tracking-widest text-primary sm:text-7xl">Page Not Found</h1>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Nice try, script kiddie</h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Now go back to your cracked tools and YouTube “hacking” tutorials
          </p>
          <Link href="/" className={cn(buttonVariants({ size: 'lg' }), 'mt-7')}>
            ← Crawl back to the homepage
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
