'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { UserMenu } from '@/components/user-menu';
import { buttonVariants } from '@/components/ui/button';
import { cn, hasLoginHintCookie, setLoggedOutHintCookie } from '@/lib/utils';
import { useGetMeQuery } from '@/store/api';

export function PublicHeaderActions() {
  const [hasLoginHint, setHasLoginHint] = useState<boolean | null>(null);
  useEffect(() => setHasLoginHint(hasLoginHintCookie()), []);

  const { data: me, isLoading, error } = useGetMeQuery(undefined, {
    skip: hasLoginHint !== true,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (error && 'status' in error && error.status === 401) {
      setLoggedOutHintCookie();
      setHasLoginHint(false);
    }
  }, [error]);

  if (hasLoginHint === null || (hasLoginHint && isLoading)) {
    return <div aria-hidden="true" className="h-9 w-36 animate-pulse rounded-lg bg-muted" />;
  }

  if (me) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          Dashboard
        </Link>
        <UserMenu me={me} />
      </div>
    );
  }

  return (
    <a href="/api/auth/login?returnTo=/dashboard" className={cn(buttonVariants({ size: 'sm' }))}>
      Log in with Discord
    </a>
  );
}
