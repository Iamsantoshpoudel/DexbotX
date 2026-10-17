'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { cn, loginUrl } from '@/lib/utils';
import { useGetMeQuery } from '@/store/api';

export function SiteHeader() {
  const { data: me, isLoading } = useGetMeQuery();
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-2">
          <ThemeToggle />
          {isLoading ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-muted" />
          ) : me ? (
            <>
              <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Dashboard
              </Link>
              <UserMenu me={me} />
            </>
          ) : (
            // A plain link, not next/link: this is a server redirect to Discord, not a client route.
            <a href={loginUrl('/dashboard')} className={cn(buttonVariants({ size: 'sm' }))}>
              Log in with Discord
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
