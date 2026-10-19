import type { ReactNode } from 'react';
import { GuildLiveUpdates } from '@/components/guild-live-updates';
import { SiteHeader } from '@/components/site-header';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuildLiveUpdates />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
