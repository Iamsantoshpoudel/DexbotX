'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { notFound, usePathname } from 'next/navigation';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage, errorStatus } from '@/lib/errors';
import { useGetAdminMeQuery } from '@/store/adminApi';
import { useGetMeQuery } from '@/store/api';
import { setLoggedOutHintCookie } from '@/lib/utils';

export function AdminGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: user, error: authError, isLoading: checkingAuth, refetch: refetchAuth } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const {
    data: admin,
    error: adminError,
    isLoading: checkingAdmin,
    refetch: refetchAdmin,
  } = useGetAdminMeQuery(undefined, { skip: !user });
  const authStatus = errorStatus(authError);
  const adminStatus = errorStatus(adminError);

  useEffect(() => {
    if (authStatus !== 401) return;
    setLoggedOutHintCookie();
    const returnTo = pathname?.startsWith('/admin') ? pathname : '/admin';
    window.location.replace(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [authStatus, pathname]);

  if (adminStatus === 404) {
    // The backend deliberately returns the same not-found response for unknown routes and non-admin users.
    notFound();
  }
  if (checkingAuth || (!user && !authError) || (user && (checkingAdmin || (!admin && !adminError)))) {
    return (
      <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-6">
        <Card role="status" className="w-full max-w-sm space-y-4 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
        </Card>
      </div>
    );
  }
  if (authStatus === 401) {
    return (
      <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center" role="status" aria-label="Loading">
        <Loader2 className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }
  if (authError) {
    return (
      <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-6">
        <Card role="alert" className="w-full max-w-md p-6">
          <h1 className="font-semibold">Could not verify your session</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage(authError)}</p>
          <button type="button" onClick={() => void refetchAuth()} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted">Try again</button>
        </Card>
      </div>
    );
  }
  if (admin) return children;
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-6">
      <Card role="alert" className="w-full max-w-md p-6">
        <h1 className="font-semibold">Could not verify admin access</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage(adminError)}</p>
        <button type="button" onClick={() => void refetchAdmin()} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted">Try again</button>
      </Card>
    </div>
  );
}
