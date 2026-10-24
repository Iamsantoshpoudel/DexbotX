'use client';

import { AlertTriangle, Clock3, Gauge, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RateLimitChart } from '@/components/admin/charts';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { useGetRateLimitsQuery } from '@/store/adminApi';

const INVALID_REQUEST_LIMIT = 10_000;
const CACHE_NAMES = [
  ['settings', 'Settings'],
  ['channels', 'Channels'],
  ['userGuilds', 'User guilds'],
] as const;

export default function AdminRateLimitsPage() {
  const [visible, setVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { data, error, isFetching, isLoading, refetch } = useGetRateLimitsQuery(undefined, {
    pollingInterval: visible ? 10_000 : 0,
    refetchOnFocus: false,
  });

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const chartData = useMemo(
    () => (data?.perMinute ?? []).map(({ minute, total, c429 }) => ({ minute, total, c429 })),
    [data],
  );
  const invalid = data?.invalidLast10Min ?? 0;
  const ratio = Math.min(1, invalid / INVALID_REQUEST_LIMIT);
  const blockedSeconds = data?.blockedUntil ? Math.max(0, Math.ceil((data.blockedUntil - now) / 1000)) : 0;
  const warning = invalid >= INVALID_REQUEST_LIMIT / 2;

  if (isLoading && !data) return <RateLimitsSkeleton />;
  if (!data && error) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <Card role="alert" className="p-6">
          <h2 className="font-semibold">Rate limits unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p>
          <button type="button" onClick={() => void refetch()} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted">Try again</button>
        </Card>
      </div>
    );
  }
  if (!data) return <RateLimitsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading />
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {isFetching && <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />}
          {isFetching ? 'Refreshing' : 'Updated every 10 seconds'}
        </div>
      </div>

      {blockedSeconds > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Discord API requests are temporarily blocked</p>
            <p className="mt-1 text-sm">Cached Discord data will be used where available. Retry window: <span className="font-semibold tabular-nums">{formatDuration(blockedSeconds)}</span>.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Discord API calls</h2>
              <p className="mt-1 text-xs text-muted-foreground">Requests per minute over the last hour. Red points mark 429 responses.</p>
            </div>
            <Clock3 aria-hidden className="size-4 text-muted-foreground" />
          </div>
          <RateLimitChart data={chartData} ariaLabel="Discord API calls per minute for the last hour, with red markers for 429 responses" />
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-destructive" />429 response
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center p-5">
          <div className="mb-3 flex items-center gap-2 self-start">
            <Gauge aria-hidden className={`size-4 ${warning ? 'text-warning' : 'text-muted-foreground'}`} />
            <h2 className="font-semibold">Invalid requests · 10 min</h2>
          </div>
          <div className="relative grid size-48 place-items-center" role="img" aria-label={`${invalid.toLocaleString('en-US')} invalid requests in the last 10 minutes out of ${INVALID_REQUEST_LIMIT.toLocaleString('en-US')}`}>
            <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={warning ? 'var(--color-warning)' : 'var(--color-primary)'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 50}
                strokeDashoffset={2 * Math.PI * 50 * (1 - ratio)}
                className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
              />
            </svg>
            <div className="text-center">
              <p className={`text-3xl font-semibold tabular-nums ${warning ? 'text-warning' : ''}`}>{invalid.toLocaleString('en-US')}</p>
              <p className="mt-1 text-xs text-muted-foreground">of {INVALID_REQUEST_LIMIT.toLocaleString('en-US')}</p>
            </div>
          </div>
          <p className={`mt-2 inline-flex items-center gap-1.5 text-sm ${warning ? 'text-warning' : 'text-muted-foreground'}`}>
            {warning && <AlertTriangle aria-hidden className="size-4" />}
            {warning ? 'Approaching Cloudflare limit' : 'Below warning threshold'}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <h2 className="font-semibold">Recent Discord rate limits</h2>
            <p className="mt-1 text-xs text-muted-foreground">Latest 20 responses; route identifiers are redacted.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Time</th>
                  <th scope="col" className="px-4 py-3 font-medium">Route</th>
                  <th scope="col" className="px-4 py-3 font-medium">Scope</th>
                  <th scope="col" className="px-4 py-3 font-medium">Retry after</th>
                  <th scope="col" className="px-4 py-3 font-medium">Global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recent429.length ? data.recent429.map((event, index) => (
                  <tr key={`${event.at}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(event.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{event.route}</td>
                    <td className="px-4 py-3">{event.scope ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDuration(event.retryAfter)}</td>
                    <td className="px-4 py-3">{event.global ? 'Yes' : 'No'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No recent 429 responses.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Cache hit rate</h2>
          <p className="mt-1 text-xs text-muted-foreground">Last 60 minutes</p>
          <div className="mt-5 space-y-5">
            {CACHE_NAMES.map(([key, label]) => {
              const rate = data.cache[key];
              return (
                <div key={key}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-semibold tabular-nums">{rate}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${label} cache hit rate`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={rate}
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Worker queue</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <QueueStat label="Waiting" value={data.queue.waiting} />
              <QueueStat label="Active" value={data.queue.active} />
              <QueueStat label="Delayed" value={data.queue.delayed} />
              <QueueStat label="Failed" value={data.queue.failed} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Rate limits</h1>
      <p className="mt-1 text-sm text-muted-foreground">Discord API usage, cooldowns and cache effectiveness.</p>
    </div>
  );
}

function QueueStat({ label, value }: { label: string; value: number }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><span className="ml-2 font-semibold tabular-nums">{value.toLocaleString('en-US')}</span></div>;
}

function RateLimitsSkeleton() {
  return (
    <div aria-label="Loading rate limits" className="space-y-6">
      <div><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-7 w-44" /><Skeleton className="mt-2 h-4 w-64" /></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-[330px] p-5"><Skeleton className="h-5 w-48" /><Skeleton className="mt-6 h-[230px] w-full" /></Card>
        <Card className="h-[330px] p-5"><Skeleton className="mx-auto size-48 rounded-full" /><Skeleton className="mx-auto mt-4 h-4 w-40" /></Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Card className="h-80 p-5"><Skeleton className="h-full w-full" /></Card>
        <Card className="h-80 p-5"><Skeleton className="h-full w-full" /></Card>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}
