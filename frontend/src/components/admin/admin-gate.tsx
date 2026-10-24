'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage, errorStatus } from '@/lib/errors';
import { loginUrl } from '@/lib/utils';
import { useGetAdminMeQuery } from '@/store/adminApi';

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, error, isLoading, refetch } = useGetAdminMeQuery();
  const status = errorStatus(error);

  useEffect(() => {
    if (status === 401) router.replace(loginUrl('/admin'));
  }, [router, status]);

  if (status === 404) {
    // The backend deliberately returns the same not-found response for unknown routes and non-admin users.
    notFound();
  }
  if (isLoading || (!data && !error)) {
    return (
      <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-6">
        <Card role="status" className="w-full max-w-sm space-y-4 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
        </Card>
      </div>
    );
  }
  if (status === 401) {
    return <div role="status" className="p-8 text-center text-sm text-muted-foreground">Redirecting to sign in…</div>;
  }
  if (data) return children;
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-6">
      <Card role="alert" className="w-full max-w-md p-6">
        <h1 className="font-semibold">Could not verify admin access</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p>
        <button type="button" onClick={() => void refetch()} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted">Try again</button>
      </Card>
    </div>
  );
}
