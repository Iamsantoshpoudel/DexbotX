'use client';

import { RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { adminApi, useClearFailuresMutation, useGetFailuresQuery, useRetryFailureMutation } from '@/store/adminApi';
import { useAppDispatch } from '@/store/hooks';

export default function AdminFailuresPage() {
  const dispatch = useAppDispatch();
  const { data, error, isLoading, isFetching } = useGetFailuresQuery();
  const [retryFailure] = useRetryFailureMutation();
  const [clearFailures, clearState] = useClearFailuresMutation();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const retry = async (id: string) => {
    setRetrying(id);
    setActionError('');
    const patch = dispatch(adminApi.util.updateQueryData('getFailures', undefined, (draft) => {
      const index = draft.findIndex((job) => job.id === id);
      if (index >= 0) draft.splice(index, 1);
    }));
    try {
      await retryFailure(id).unwrap();
    } catch (err) {
      patch.undo();
      setActionError(errorMessage(err));
    } finally {
      setRetrying(null);
    }
  };

  const clear = async () => {
    if (!window.confirm('Permanently remove all failed jobs? This cannot be undone.')) return;
    setActionError('');
    try {
      await clearFailures({ confirm: true }).unwrap();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Failures</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inspect and retry failed member-event jobs.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">{isFetching ? 'Refreshing…' : `${data?.length ?? 0} failed jobs`}</span>
          <button type="button" disabled={!data?.length || clearState.isLoading} onClick={() => void clear()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-destructive/50 px-3 text-sm text-destructive disabled:opacity-40">
            <Trash2 aria-hidden className="size-4" />Clear all
          </button>
        </div>
      </div>

      {actionError && <Card role="alert" className="border-destructive/50 p-4 text-sm text-destructive">{actionError}</Card>}
      {error && !data ? (
        <Card role="alert" className="p-6"><h2 className="font-semibold">Failed jobs unavailable</h2><p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p></Card>
      ) : isLoading && !data ? (
        <FailuresSkeleton />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Time</th>
                  <th scope="col" className="px-4 py-3 font-medium">Job ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Kind</th>
                  <th scope="col" className="px-4 py-3 font-medium">Guild ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                  <th scope="col" className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.length ? data.map((job) => (
                  <tr key={job.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(job.time)}</td>
                    <td className="max-w-40 truncate px-4 py-3 font-mono text-xs" title={job.id}>{job.id}</td>
                    <td className="px-4 py-3 capitalize">{job.kind}</td>
                    <td className="px-4 py-3 font-mono text-xs">{job.guildId}</td>
                    <td className="px-4 py-3"><Reason reason={job.reason} /></td>
                    <td className="px-4 py-3">
                      <button type="button" disabled={retrying !== null} onClick={() => void retry(job.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-muted disabled:opacity-40">
                        <RefreshCw aria-hidden className={`size-3.5 ${retrying === job.id ? 'animate-spin motion-reduce:animate-none' : ''}`} />Retry
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No failed jobs.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Reason({ reason }: { reason: string }) {
  const alert = reason === 'missing permission' || reason === 'deleted channel';
  return <span className={alert ? 'text-warning' : reason === 'render error' ? 'text-destructive' : 'text-muted-foreground'}>{reason}</span>;
}

function FailuresSkeleton() {
  return <Card className="overflow-hidden p-4"><Skeleton className="h-10 w-full" /><div className="mt-3 space-y-2">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div></Card>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}
