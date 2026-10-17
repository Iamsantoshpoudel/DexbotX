'use client';

import { ArrowRight, Crown, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { GuildIcon } from '@/components/guild-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge, Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useGetGuildsQuery } from '@/store/api';

export default function DashboardPage() {
  const { data: guilds, isLoading, isFetching, error, refetch } = useGetGuildsQuery();

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

      {error && (
        <Card className="mt-6 border-destructive/30 p-5 text-sm" role="alert">
          <p className="text-destructive">{errorMessage(error, 'Could not load your servers.')}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}

        {guilds?.map((g) => (
          <Card key={g.id} className="flex flex-col gap-4 p-5 transition-colors hover:border-border-strong">
            <div className="flex items-center gap-3">
              <GuildIcon name={g.name} iconUrl={g.iconUrl} />
              <div className="min-w-0">
                <h2 className="truncate font-medium">{g.name}</h2>
                <div className="mt-1 flex gap-1.5">
                  {g.owner && (
                    <Badge tone="warning">
                      <Crown className="mr-1 size-3" /> Owner
                    </Badge>
                  )}
                  <Badge tone={g.botInstalled ? 'success' : 'neutral'}>{g.botInstalled ? 'Bot added' : 'Not added'}</Badge>
                </div>
              </div>
            </div>
            {g.botInstalled ? (
              <Link href={`/dashboard/${g.id}/welcome`} className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'mt-auto w-full')}>
                Configure <ArrowRight />
              </Link>
            ) : (
              <a href={g.inviteUrl ?? '#'} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-auto w-full')}>
                <Plus /> Add DexbotX
              </a>
            )}
          </Card>
        ))}
      </div>

      {guilds && guilds.length === 0 && (
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
