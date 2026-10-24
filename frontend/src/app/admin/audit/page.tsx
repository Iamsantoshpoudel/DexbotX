'use client';

import { useState } from 'react';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { useGetAdminAuditQuery } from '@/store/adminApi';

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, error, isLoading, isFetching } = useGetAdminAuditQuery({ page, action });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Audit log</h1><p className="mt-1 text-sm text-muted-foreground">Administrative changes, newest first.</p></div>
        <label className="text-xs font-medium text-muted-foreground">Action filter
          <input value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="e.g. settings.update_flags" className="mt-1 block min-h-10 w-64 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
        </label>
      </div>
      {isFetching && data && <p className="text-xs text-muted-foreground" aria-live="polite">Refreshing audit events…</p>}
      {error && !data ? <Card role="alert" className="p-6 text-sm text-destructive">{errorMessage(error)}</Card> : isLoading && !data ? <AuditSkeleton /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Admin ID</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Target</th></tr></thead>
              <tbody className="divide-y divide-border">
                {data?.items.length ? data.items.map((event) => <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{event.adminId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{event.action}</td>
                  <td className="max-w-80 truncate px-4 py-3 font-mono text-xs" title={event.target}>{event.target}</td>
                </tr>) : <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No audit events match this action.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">{data?.total ?? 0} events</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-border px-3 disabled:opacity-40">Previous</button>
              <span className="tabular-nums text-muted-foreground">{page} / {Math.max(data?.pages ?? 0, 1)}</span>
              <button type="button" disabled={!data || page >= data.pages || isFetching} onClick={() => setPage((value) => value + 1)} className="min-h-9 rounded-lg border border-border px-3 disabled:opacity-40">Next</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function AuditSkeleton() {
  return <Card className="space-y-3 p-4"><Skeleton className="h-10 w-full" />{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</Card>;
}
