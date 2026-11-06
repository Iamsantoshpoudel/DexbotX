'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { PublicHeaderActions } from '@/components/public-header-actions';
import { PublicMobileNav } from '@/components/public-mobile-nav';

const PUBLIC_NAVIGATION = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/commands', label: 'Commands' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export function PublicSiteHeader() {
  const pathname = usePathname();
  const isAppPage = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  return (
    <header aria-hidden={isAppPage} className={`sticky top-0 z-20 border-b border-white/10 bg-[#10111d]/85 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl ${isAppPage ? 'hidden' : ''}`}>
      <div className="mx-auto grid min-h-24 max-w-7xl grid-cols-[1fr_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-1 px-4 py-2 lg:min-h-16 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-1 lg:gap-x-6 lg:px-6 lg:py-0">
        <div className="col-start-1 row-start-1 flex h-11 items-center">
          <Logo />
        </div>
        <PublicMobileNav links={PUBLIC_NAVIGATION} />
        <nav aria-label="Main" className="hidden h-11 items-center justify-center gap-5 text-sm lg:col-start-2 lg:row-start-1 lg:flex lg:gap-6">
          {PUBLIC_NAVIGATION.map(({ href, label }) => (
            <Link key={href} className="rounded-sm text-white/70 underline-offset-4 hover:text-white hover:underline" href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="col-start-2 row-start-1 flex h-11 items-center justify-self-end lg:col-span-1 lg:col-start-3 lg:row-start-1">
          <PublicHeaderActions />
        </div>
      </div>
    </header>
  );
}
