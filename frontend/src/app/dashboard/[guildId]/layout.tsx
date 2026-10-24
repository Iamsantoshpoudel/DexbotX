'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { DashboardTopBar } from '@/components/dashboard/top-bar';
import { Sidebar } from '@/components/dashboard/sidebar';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { errorMessage, errorStatus } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGetGuildQuery, useRefreshGuildMutation } from '@/store/api';

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
  const { data, error } = useGetGuildQuery(guildId, { pollingInterval: poll404 ? 2000 : 0 });
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
    const title = status === 403 ? 'No access to this server' : status === 404 ? (giveUp404 ? 'DexBotX is not in this server' : 'Waiting for DexBotX to join this server…') : 'Could not load this server';
    const waiting = status === 404 && !giveUp404;
    if (status === 404 && !giveUp404) {
      return <><DashboardTopBar /><main className="w-full px-4 py-8 sm:px-8"><Card className="w-full p-8 text-center" role="status"><h1 className="text-lg font-semibold">{title}</h1></Card></main></>;
    }
    return (
      <><DashboardTopBar /><main className="w-full px-4 py-8 sm:px-8"><Card className="w-full p-8 text-center" role="alert">
        <h1 className="text-lg font-semibold">{title}</h1>
        {!waiting && <p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {status === 404 && <a href="/api/invite" className={cn(buttonVariants(), 'min-h-11')}>Add DexBotX</a>}
          <Link href="/dashboard" className={cn(buttonVariants({ variant: 'secondary' }), 'min-h-11')}>Back to your servers</Link>
        </div>
      </Card></main></>
    );
  }

  return (
    <div className="fade-up">
      <DashboardTopBar guildId={guildId} guild={data?.guild} lastSyncedLabel={data ? formatLastSynced(data.guild.lastSyncedAt, now) : undefined} refreshing={refreshing} cooldownSeconds={cooldownSeconds} onRefresh={onRefresh} />
      <div className="flex min-h-[calc(100dvh-3.5rem)]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-surface lg:block">
          <Sidebar guild={data?.guild} guildId={guildId} pathname={pathname} lastSyncedLabel={data ? formatLastSynced(data.guild.lastSyncedAt, now) : undefined} />
        </aside>
        <main className="min-w-0 max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
