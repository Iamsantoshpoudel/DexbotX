import type { ReactNode } from 'react';
import { DashboardAuthGate } from '@/components/dashboard/auth-gate';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardAuthGate>{children}</DashboardAuthGate>
  );
}
