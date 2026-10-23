'use client';

import { ArrowRight, Crown, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { GuildIcon } from '@/components/guild-icon';
import { SiteHeader } from '@/components/site-header';
import { GuildListSkeleton } from '@/components/dashboard/loading-skeleton';
import { useDelayedLoading } from '@/components/dashboard/use-delayed-loading';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { readGuildsCache, writeGuildsCache } from '@/lib/server-cache';
import { cn } from '@/lib/utils';
import { useGetGuildsQuery, useGetMeQuery } from '@/store/api';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const added = searchParams.get('added');
  const [timedOut, setTimedOut] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const { data: me } = useGetMeQuery();
  const { data: guilds, isLoading, isFetching, error, refetch } = useGetGuildsQuery(undefined, {
    pollingInterval: added && !timedOut ? 2000 : 0,
  });
  const waiting = Boolean(added && !guilds?.some((g) => g.id === added && g.botInstalled));

  const [cachedGuilds, setCachedGuilds] = useState<{ userId: string; guilds: NonNullable<typeof guilds> } | null>(null);

  useEffect(() => {
    if (!added) {
      setTimedOut(false);
      return;
    }
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), 45_000);
    return () => clearTimeout(t);
  }, [added, retryTick]);

  useEffect(() => {
    if (added && guilds?.some((g) => g.id === added && g.botInstalled)) {
      router.replace(`/dashboard/${added}/welcome`);
    }
  }, [added, guilds, router]);

  useEffect(() => {
    if (me?.id) {
      const cached = readGuildsCache(me.id);
      setCachedGuilds(cached ? { userId: me.id, guilds: cached } : null);
    } else {
      setCachedGuilds(null);
    }
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id || !guilds) return;
    writeGuildsCache(me.id, guilds);
    setCachedGuilds({ userId: me.id, guilds });
  }, [me?.id, guilds]);

  const visibleGuilds =
    guilds ?? (cachedGuilds && me && cachedGuilds.userId === me.id ? cachedGuilds.guilds : undefined);
  const showGuildSkeleton = useDelayedLoading(isLoading && !visibleGuilds);

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your servers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Servers where you can manage settings. Add DexbotX to a server to configure it.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn(isFetching && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {waiting && !timedOut && (
        <Card className="mt-6 border-primary/30 p-5 text-sm" role="status">
          <p className="font-medium">Finishing setup…</p>
          <p className="mt-1 text-muted-foreground">Waiting for DexBotX to show up in this server.</p>
        </Card>
      )}

      {waiting && timedOut && (
        <Card className="mt-6 border-warning/30 p-5 text-sm" role="status">
          <p className="font-medium">DexBotX hasn’t appeared in this server yet.</p>
          <p className="mt-1 text-muted-foreground">If you just added it, Discord can take a moment. Retry to check again.</p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => {
              setRetryTick((n) => n + 1);
              void refetch();
            }}
          >
            Retry
          </Button>
        </Card>
      )}

      {error && (
        <Card className="mt-6 border-destructive/30 p-5 text-sm" role="alert">
          <p className="text-destructive">{errorMessage(error, 'Could not load your servers.')}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      )}

      <div className="mt-6">
        {showGuildSkeleton ? (
          <GuildListSkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGuilds?.map((g) => (
              <Card
                key={g.id}
                className="flex flex-col gap-4 p-5 transition-colors hover:border-border-strong"
                onMouseEnter={() => router.prefetch(`/dashboard/${g.id}/overview`)}
                onFocusCapture={() => router.prefetch(`/dashboard/${g.id}/overview`)}
              >
                <div className="flex items-center gap-3">
                  <GuildIcon name={g.name} iconUrl={g.iconUrl} />
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{g.name}</h2>
                    <div className="mt-1 flex gap-1.5">
                      {g.owner && <Badge tone="warning"><Crown className="mr-1 size-3" /> Owner</Badge>}
                      <Badge tone={g.botInstalled ? 'success' : 'neutral'}>{g.botInstalled ? 'Bot added' : 'Not added'}</Badge>
                    </div>
                  </div>
                </div>
                {g.botInstalled ? (
                  <Link prefetch href={`/dashboard/${g.id}/welcome`} className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'mt-auto w-full')}>
                    Configure <ArrowRight />
                  </Link>
                ) : (
                  <a href={g.inviteUrl ?? '#'} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-auto w-full')}>
                    <Plus /> Add DexBotX
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {visibleGuilds && visibleGuilds.length === 0 && (
        <Card className="mt-6 p-8 text-center">
          <h2 className="font-medium">No servers yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">You need the Manage Server permission to configure a server. Ask an admin, or create your own server and add DexbotX.</p>
          <a href="/api/invite" className={cn(buttonVariants({ className: 'mt-4' }))}>
            Add to Discord
          </a>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense fallback={null}>
          <DashboardContent />
        </Suspense>
      </main>
    </>
  );
}
