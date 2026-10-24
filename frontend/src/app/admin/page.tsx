'use client';

import { Activity, AlertTriangle, Clock3, MessageSquare, Server, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AreaChart, BarChart, Sparkline } from '@/components/admin/charts';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { useGetOverviewQuery } from '@/store/adminApi';

const HEALTH_ITEMS = [
  ['api', 'API'],
  ['redis', 'Redis'],
  ['postgres', 'Postgres'],
  ['bot', 'Bot'],
  ['worker', 'Worker'],
] as const;

export default function AdminOverviewPage() {
  const [days, setDays] = useState<7 | 30>(30);
  const [visible, setVisible] = useState(false);
  const { data, error, isFetching, isLoading, refetch } = useGetOverviewQuery(undefined, {
    pollingInterval: visible ? 15_000 : 0,
    refetchOnFocus: false,
  });

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const serverData = useMemo(
    () => (data?.series.servers ?? []).slice(-days).map((point) => ({ label: shortDate(point.date), value: point.total })),
    [data, days],
  );
  const messageData = useMemo(
    () => (data?.series.messages ?? []).slice(-days).map((point) => ({ label: shortDate(point.date), sent: point.sent, failed: point.failed })),
    [data, days],
  );

  if (isLoading && !data) return <OverviewSkeleton />;
  if (!data && error) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <Card role="alert" className="p-6">
          <h2 className="font-semibold">Overview unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p>
          <button type="button" onClick={() => void refetch()} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted">Try again</button>
        </Card>
      </div>
    );
  }
  if (!data) return <OverviewSkeleton />;

  const { health, totals, shards, queue } = data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading />
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {isFetching && <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />}
          {isFetching ? 'Refreshing' : 'Live overview'}
        </div>
      </div>

      <section aria-label="Service health" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {HEALTH_ITEMS.map(([key, label]) => {
          const check = health[key];
          return (
            <Card key={key} className="flex min-h-[72px] items-center gap-3 px-4 py-3">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${check.ok ? 'bg-success' : 'bg-destructive'}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{label} <span className={check.ok ? 'text-success' : 'text-destructive'}>{check.ok ? 'Operational' : 'Issue'}</span></p>
                <p className="truncate text-xs text-muted-foreground">{check.detail}</p>
              </div>
            </Card>
          );
        })}
      </section>

      <section aria-label="Platform totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Installed servers" value={totals.servers} icon={Server} sample={data.series.servers.map((point) => point.total)} />
        <StatCard title="Users ever" value={totals.usersEver} icon={Users} />
        <StatCard title="Users today" value={totals.usersToday} icon={Activity} />
        <StatCard title="Messages · 24 hours" value={totals.messages24h} icon={MessageSquare} sample={data.series.messages.map((point) => point.sent)} />
        <StatCard title="Failed · 24 hours" value={totals.failed24h} icon={AlertTriangle} sample={data.series.messages.map((point) => point.failed)} danger={totals.failed24h > 0} />
      </section>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Service queue</h2>
            <p className="mt-1 text-xs text-muted-foreground">Oldest pending job: {formatDuration(queue.oldestWaitingSeconds)}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-4">
            <QueueStat label="Waiting" value={queue.waiting} />
            <QueueStat label="Active" value={queue.active} />
            <QueueStat label="Delayed" value={queue.delayed} />
            <QueueStat label="Failed" value={queue.failed} danger={queue.failed > 0} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-5">
          <ChartHeader title="Servers over time" days={days} onDaysChange={setDays} />
          <AreaChart data={serverData} ariaLabel={`Installed server totals over the last ${days} days`} />
          <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
            <span>Joins: {data.series.servers.slice(-days).reduce((sum, point) => sum + point.joins, 0).toLocaleString('en-US')}</span>
            <span>Leaves: {data.series.servers.slice(-days).reduce((sum, point) => sum + point.leaves, 0).toLocaleString('en-US')}</span>
          </div>
        </Card>
        <Card className="min-w-0 p-4 sm:p-5">
          <ChartHeader title="Messages" days={days} onDaysChange={setDays} />
          <div className="mb-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-success" />Sent</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-destructive" />Failed</span>
          </div>
          <BarChart data={messageData} ariaLabel={`Messages sent and failed per day for the last ${days} days`} />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-semibold">Bot shards</h2>
            <p className="mt-1 text-xs text-muted-foreground">Heartbeat freshness is under 45 seconds.</p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Clock3 aria-hidden className="size-4" />{shards.length} reported</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Shard</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Ping</th>
                <th scope="col" className="px-5 py-3 font-medium">Servers</th>
                <th scope="col" className="px-5 py-3 font-medium">Reconnects</th>
                <th scope="col" className="px-5 py-3 font-medium">Last heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shards.length ? shards.map((shard) => (
                <tr key={shard.id}>
                  <td className="px-5 py-3 font-mono">#{shard.id}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-2 ${shard.status === 'online' ? 'text-success' : 'text-warning'}`}><span className={`size-2 rounded-full ${shard.status === 'online' ? 'bg-success' : 'bg-warning'}`} />{shard.status}</span></td>
                  <td className="px-5 py-3 tabular-nums">{Number.isFinite(shard.pingMs) ? `${Math.round(shard.pingMs)} ms` : '—'}</td>
                  <td className="px-5 py-3 tabular-nums">{shard.guilds.toLocaleString('en-US')}</td>
                  <td className="px-5 py-3 tabular-nums">{shard.reconnects}</td>
                  <td className="px-5 py-3 text-muted-foreground">{timeAgo(shard.at)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No recent shard heartbeats.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Live health and activity across DexBotX.</p>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, sample, danger = false }: { title: string; value: number; icon: typeof Server; sample?: number[]; danger?: boolean }) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon aria-hidden className={`size-4 shrink-0 ${danger ? 'text-destructive' : 'text-muted-foreground'}`} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <CountUp value={value} className={`text-2xl font-semibold tabular-nums ${danger ? 'text-destructive' : ''}`} />
        {sample && <div className="w-16"><Sparkline data={sample} ariaLabel={`${title} daily trend`} /></div>}
      </div>
    </Card>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Math.max(0, value);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / 650);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={className}>{display.toLocaleString('en-US')}</span>;
}

function ChartHeader({ title, days, onDaysChange }: { title: string; days: 7 | 30; onDaysChange: (value: 7 | 30) => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      <div role="group" aria-label={`${title} chart range`} className="flex rounded-lg border border-border p-0.5">
        {([7, 30] as const).map((range) => (
          <button key={range} type="button" aria-pressed={days === range} onClick={() => onDaysChange(range)} className={`min-h-8 rounded-md px-2.5 text-xs ${days === range ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {range}d
          </button>
        ))}
      </div>
    </div>
  );
}

function QueueStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><span className={`ml-2 font-semibold tabular-nums ${danger ? 'text-destructive' : ''}`}>{value.toLocaleString('en-US')}</span></div>;
}

function OverviewSkeleton() {
  return (
    <div aria-label="Loading admin overview" className="space-y-6">
      <div><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-7 w-44" /><Skeleton className="mt-2 h-4 w-64" /></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Card key={index} className="h-[72px] p-4"><Skeleton className="h-4 w-32" /><Skeleton className="mt-2 h-3 w-24" /></Card>)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Card key={index} className="h-[112px] p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-5 h-7 w-28" /></Card>)}</div>
      <Card className="h-[86px] p-5"><Skeleton className="h-full w-full" /></Card>
      <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <Card key={index} className="h-[330px] p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-6 h-[230px] w-full" /></Card>)}</div>
      <Card className="h-72 p-5"><Skeleton className="h-full w-full" /></Card>
    </div>
  );
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
