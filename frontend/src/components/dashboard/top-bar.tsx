'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import type { GuildDetail, Me } from '@/lib/types';
import type { RealtimeStatus } from '@/lib/realtime';
import { useGetMeQuery } from '@/store/api';
import { MobileNav } from './mobile-nav';

export function DashboardTopBar({ guildId, guild, lastSyncedLabel, refreshing, cooldownSeconds, onRefresh, realtimeStatus }: { guildId?: string; guild?: GuildDetail; lastSyncedLabel?: string; refreshing?: boolean; cooldownSeconds?: number; onRefresh?: () => void; realtimeStatus?: RealtimeStatus }) {
  const { data: me, isLoading: loadingMe } = useGetMeQuery();
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-surface">
      <div className="flex h-full items-center gap-2 px-3 sm:px-5">
        {guildId && <MobileNav guild={guild} guildId={guildId} lastSyncedLabel={lastSyncedLabel} />}
        <Link href="/dashboard" aria-label="DexBotX dashboard home" className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogoMark className="size-8" />
          <span className="hidden text-sm font-semibold sm:inline">DexBotX</span>
        </Link>
        {guildId && (
          <>
            <span aria-hidden="true" className="h-6 border-l border-border" />
            {guild ? (
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{guild.name}</span>
            ) : (
              <Skeleton className="h-4 w-32 shrink-0 sm:flex-1" />
            )}
          </>
        )}
        {!guildId && <span className="flex-1" />}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {guild && onRefresh ? (
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Refresh server data" title={cooldownSeconds ? `Refresh available in ${cooldownSeconds}s` : 'Refresh server data'} disabled={refreshing || (cooldownSeconds ?? 0) > 0} onClick={onRefresh}>
              <RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
            </Button>
          ) : guildId ? (
            <Skeleton className="hidden size-11 shrink-0 sm:block" />
          ) : null}
          {guildId && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${realtimeStatus === 'live' ? 'bg-success' : 'bg-warning animate-pulse motion-reduce:animate-none'}`}
              />
              {realtimeStatus === 'live' ? 'Live' : 'Reconnecting'}
            </span>
          )}
          <ThemeToggle />
          {me ? <UserMenu me={me as Me} /> : loadingMe ? <Skeleton className="h-11 w-11 shrink-0 sm:w-28" /> : null}
        </div>
      </div>
    </header>
  );
}