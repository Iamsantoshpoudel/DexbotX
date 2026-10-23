import type { ReactNode } from 'react';
import { GuildLiveUpdates } from '@/components/guild-live-updates';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuildLiveUpdates />
      {children}
    </>
  );
}
