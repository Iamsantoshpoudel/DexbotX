'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { GuildIcon } from '@/components/guild-icon';
import { buttonVariants } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage, errorStatus } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useGetGuildQuery } from '@/store/api';

const TABS = [
  { kind: 'welcome', label: 'Welcome' },
  { kind: 'goodbye', label: 'Goodbye' },
] as const;

export default function GuildLayout({ children }: { children: ReactNode }) {
  const { guildId } = useParams<{ guildId: string }>();
  const pathname = usePathname();
  const { data, isLoading, error } = useGetGuildQuery(guildId);

  if (error) {
    const status = errorStatus(error);
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center" role="alert">
        <h1 className="text-lg font-semibold">{status === 403 ? 'No access to this server' : status === 404 ? 'DexbotX is not in this server' : 'Could not load this server'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: 'secondary', className: 'mt-5' }))}>
          Back to your servers
        </Link>
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
              <h1 className="truncate text-xl font-semibold tracking-tight">{data.guild.name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-3.5" /> {data.guild.memberCount.toLocaleString('en-US')} members
              </p>
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
