'use client';

import type { ReactNode } from 'react';
import { BarChart3, CircleGauge, FileText, Server, Settings, Shield, TriangleAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useGetMeQuery } from '@/store/api';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Overview', href: '/admin', icon: CircleGauge },
  { label: 'Rate limits', href: '/admin/rate-limits', icon: BarChart3 },
  { label: 'Servers', href: '/admin/servers', icon: Server },
  { label: 'Failures', href: '/admin/failures', icon: TriangleAlert },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Audit', href: '/admin/audit', icon: Shield },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const { data: me } = useGetMeQuery();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogoMark className="size-8" />
          <span>DexBotX <span className="font-normal text-muted-foreground">/ Admin</span></span>
        </Link>
        <div className="flex-1" />
        <span className="hidden text-xs text-muted-foreground sm:inline">Operations console</span>
        <ThemeToggle />
        {me && <UserMenu me={me} />}
      </header>
      <div className="flex min-h-[calc(100dvh-3.5rem)]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-surface lg:block">
          <AdminNavigation vertical />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-border bg-surface px-3 py-2 lg:hidden">
            <AdminNavigation />
          </div>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function AdminNavigation({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin navigation" className={vertical ? 'space-y-1 p-3' : 'flex gap-1 overflow-x-auto'}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href);
        return (
        <div key={item.label} className={vertical ? '' : 'shrink-0'}>
          <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${active ? 'bg-accent-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {item.label}
          </Link>
        </div>
        );
      })}
    </nav>
  );
}
