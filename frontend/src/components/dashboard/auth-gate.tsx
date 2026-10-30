'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/misc';
import { Loader } from '@/components/ui/loader';
import { errorMessage, errorStatus } from '@/lib/errors';
import { useGetMeQuery } from '@/store/api';

export function DashboardAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, error, isLoading, refetch } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const status = errorStatus(error);

  useEffect(() => {
    if (status !== 401) return;
    const returnTo = pathname?.startsWith('/dashboard') ? pathname : '/dashboard';
    window.location.replace(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [pathname, status]);

  if (status === 401) {
    return <Loader />;
  }

  if (isLoading || (!data && !error)) {
    return <Loader />;
  }

  if (error || !data) {
    return (
      <div className="grid min-h-[50dvh] place-items-center p-6">
        <Card role="alert" className="w-full max-w-sm p-5 text-center">
          <p className="text-sm text-muted-foreground">
            {errorMessage(error, 'Could not verify your session.')}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </Card>
      </div>
    );
  }

  return children;
}
