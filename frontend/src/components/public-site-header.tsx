import Link from 'next/link';
import { Logo } from '@/components/logo';
import { PublicHeaderActions } from '@/components/public-header-actions';

const PUBLIC_NAVIGATION = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/commands', label: 'Commands' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto grid min-h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:h-16 sm:grid-cols-[1fr_auto_1fr] sm:gap-x-6 sm:px-6 sm:py-0">
        <div className="col-start-1 row-start-1 flex h-11 items-center">
          <Logo />
        </div>
        <nav aria-label="Main" className="col-span-2 row-start-2 flex h-11 items-center justify-center gap-5 text-sm sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:gap-6">
          {PUBLIC_NAVIGATION.map(({ href, label }) => (
            <Link key={href} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="col-start-2 row-start-1 flex h-11 items-center justify-self-end sm:col-start-3">
          <PublicHeaderActions />
        </div>
      </div>
    </header>
  );
}
