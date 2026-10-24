'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { clearLoginHintCookie, cn, hasLoginHintCookie } from '@/lib/utils';
import { useGetMeQuery } from '@/store/api';
import { useEffect, useState } from 'react';

export function SiteHeader() {
  const pathname = usePathname();
  const [hasLoginHint, setHasLoginHint] = useState(false);
  useEffect(() => setHasLoginHint(hasLoginHintCookie()), []);
  const { data: me, isLoading, error } = useGetMeQuery(undefined, { skip: !hasLoginHint });

  useEffect(() => {
    if (error && 'status' in error && error.status === 401) {
      clearLoginHintCookie();
      setHasLoginHint(false);
    }
  }, [error]);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-2">
          <ThemeToggle />
          {hasLoginHint && isLoading && !pathname.startsWith('/dashboard') ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-muted" />
          ) : me ? (
            <>
              <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Dashboard
              </Link>
              <UserMenu me={me} />
            </>
          ) : (
            <a href="/api/auth/login?returnTo=/dashboard" className={cn(buttonVariants({ size: 'sm' }))}>
              Log in with Discord
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
