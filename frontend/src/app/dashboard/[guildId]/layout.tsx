'use client';

import { RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { GuildIcon } from '@/components/guild-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage, errorStatus } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGetGuildQuery, useRefreshGuildMutation } from '@/store/api';

const TABS = [
  { kind: 'welcome', label: 'Welcome' },
  { kind: 'goodbye', label: 'Goodbye' },
] as const;

function formatLastSynced(timestamp: string | null, now: number): string {
  if (!timestamp) return 'Last synced not yet';
  const minutes = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 60_000));
  return `Last synced ${minutes < 1 ? 'just now' : `${minutes} min ago`}`;
}

export default function GuildLayout({ children }: { children: ReactNode }) {
  const { guildId } = useParams<{ guildId: string }>();
  const pathname = usePathname();
  const [giveUp404, setGiveUp404] = useState(false);
  const [poll404, setPoll404] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const { data, isLoading, error } = useGetGuildQuery(guildId, { pollingInterval: poll404 ? 2000 : 0 });
  const [refreshGuild, { isLoading: refreshing }] = useRefreshGuildMutation();
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const cooldownActive = cooldownSeconds > 0;
  const notFound = errorStatus(error) === 404;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), cooldownActive ? 1000 : 60_000);
    return () => clearInterval(timer);
  }, [cooldownActive]);

  async function onRefresh() {
    setCooldownUntil(Date.now() + 30_000);
    try {
      await refreshGuild(guildId).unwrap();
      toast.success('Server data refreshed');
    } catch (refreshError) {
      if (errorStatus(refreshError) !== 429) toast.error(errorMessage(refreshError));
    }
  }

  useEffect(() => {
    setGiveUp404(false);
    setPoll404(false);
  }, [guildId]);

  useEffect(() => {
    setPoll404(notFound && !giveUp404);
  }, [notFound, giveUp404]);

  useEffect(() => {
    if (!notFound) return;
    const t = setTimeout(() => setGiveUp404(true), 30_000);
    return () => clearTimeout(t);
  }, [guildId, notFound]);

  if (error) {
    const status = errorStatus(error);
    if (status === 404 && !giveUp404) {
      return (
        <Card className="mx-auto mt-10 max-w-lg p-8 text-center" role="status">
          <h1 className="text-lg font-semibold">Waiting for DexBotX to join this server…</h1>
        </Card>
      );
    }
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center" role="alert">
        <h1 className="text-lg font-semibold">{status === 403 ? 'No access to this server' : status === 404 ? 'DexbotX is not in this server' : 'Could not load this server'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {status === 404 && (
            <a href="/api/invite" className={cn(buttonVariants())}>
              Add DexBotX
            </a>
          )}
          <Link href="/dashboard" className={cn(buttonVariants({ variant: 'secondary' }))}>
            Back to your servers
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {isLoading || !data ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-12" />
            <Skeleton className="h-6 w-48" />
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <GuildIcon name={data.guild.name} iconUrl={data.guild.iconUrl} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="truncate text-xl font-semibold tracking-tight">{data.guild.name}</h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Refresh server data"
                  title={cooldownSeconds > 0 ? `Refresh available in ${cooldownSeconds}s` : 'Refresh server data'}
                  disabled={refreshing || cooldownSeconds > 0}
                  onClick={onRefresh}
                >
                  <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-3.5" /> {data.guild.memberCount.toLocaleString('en-US')} members
              </p>
              <p className="text-xs text-muted-foreground">{formatLastSynced(data.guild.lastSyncedAt, now)}</p>
            </div>
          </div>
        )}
        <nav aria-label="Message type" className="flex rounded-xl border border-border bg-card/60 p-1">
          {TABS.map((t) => {
            const href = `/dashboard/${guildId}/${t.kind}`;
            const active = pathname === href;
            return (
              <Link key={t.kind} href={href} aria-current={active ? 'page' : undefined} className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
