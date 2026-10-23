import Link from 'next/link';
import { GuildIcon } from '@/components/guild-icon';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import type { GuildDetail } from '@/lib/types';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, type NavItem } from './nav-config';

const SECTIONS = [
  { id: 'server', label: 'Server' },
  { id: 'modules', label: 'Modules' },
  { id: 'soon', label: 'Coming soon' },
] as const;

export function Sidebar({ guild, guildId, pathname, lastSyncedLabel, onNavigate }: { guild?: GuildDetail; guildId: string; pathname: string; lastSyncedLabel?: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Server navigation" className="space-y-6 p-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-3">
          {guild ? <GuildIcon name={guild.name} iconUrl={guild.iconUrl} className="size-10 rounded-lg" /> : <Skeleton className="size-10 rounded-lg" />}
          <div className="min-w-0 flex-1">
            {guild ? <p className="truncate text-sm font-semibold">{guild.name}</p> : <Skeleton className="h-4 w-28" />}
            {guild ? <p className="text-xs text-muted-foreground">{guild.memberCount.toLocaleString('en-US')} members</p> : <Skeleton className="mt-1 h-3 w-20" />}
            {lastSyncedLabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{lastSyncedLabel}</p>}
          </div>
        </div>
        <Link href="/dashboard" prefetch className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 min-h-11 w-full')} onClick={onNavigate}>
          Switch server
        </Link>
      </div>

      {SECTIONS.map((section) => {
        const items = NAV_ITEMS.filter((item) => item.section === section.id);
        return (
          <section key={section.id} aria-labelledby={`nav-section-${section.id}`}>
            <h2 id={`nav-section-${section.id}`} className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </h2>
            <ul className="space-y-1">
              {items.map((item) => <SidebarItem key={item.id} item={item} guildId={guildId} pathname={pathname} onNavigate={onNavigate} />)}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function SidebarItem({ item, guildId, pathname, onNavigate }: { item: NavItem; guildId: string; pathname: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (item.soon || !item.href) {
    return (
      <li>
        <div aria-disabled="true" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground opacity-50">
          <Icon aria-hidden="true" className="size-[18px] shrink-0" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
        </div>
      </li>
    );
  }

  const href = item.href(guildId);
  const active = pathname.startsWith(href) || (item.id === 'overview' && pathname === `/dashboard/${guildId}`);
  return (
    <li>
      <Link
        href={href}
        prefetch
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'bg-accent-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}