'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { useGetAdminUsersQuery, useRevokeUserSessionsMutation } from '@/store/adminApi';

export default function AdminUsersPage() {
  const { data, error, isLoading } = useGetAdminUsersQuery();
  const [revoke, revokeState] = useRevokeUserSessionsMutation();
  const [actionError, setActionError] = useState('');

  const revokeSessions = async (id: string) => {
    if (!window.confirm(`Revoke all active sessions for user ${id}?`)) return;
    setActionError('');
    try {
      await revoke(id).unwrap();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recent sign-ins and active dashboard sessions.</p>
      </div>
      {actionError && <Card role="alert" className="border-destructive/50 p-4 text-sm text-destructive">{actionError}</Card>}
      {isLoading && !data ? <UsersSkeleton /> : error && !data ? (
        <Card role="alert" className="p-6 text-sm text-destructive">{errorMessage(error)}</Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Active sessions</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{data?.activeSessions ?? 0}</p>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-border p-4"><h2 className="font-semibold">Recent logins</h2></div>
            <div className="divide-y divide-border">
              {data?.recentLogins.length ? data.recentLogins.map((user, index) => (
                <div key={`${user.id}-${index}`} className="flex items-center gap-3 px-4 py-3">
                  <Image src={user.avatar} alt="" width={36} height={36} unoptimized className="size-9 rounded-full bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.username}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{user.id}</p>
                  </div>
                  <button type="button" disabled={revokeState.isLoading} onClick={() => void revokeSessions(user.id)} className="min-h-9 rounded-lg border border-destructive/50 px-3 text-xs text-destructive disabled:opacity-50">
                    Revoke sessions
                  </button>
                </div>
              )) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">No login events recorded.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function UsersSkeleton() {
  return <div className="space-y-4"><Card className="h-24 p-5"><Skeleton className="h-full w-40" /></Card><Card className="space-y-3 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</Card></div>;
}
