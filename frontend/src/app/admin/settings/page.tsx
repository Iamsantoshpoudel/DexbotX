'use client';

import { useEffect, useState } from 'react';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { useGetAdminFlagsQuery, useUpdateAdminFlagsMutation } from '@/store/adminApi';
import type { AdminFlags } from '@/lib/admin-types';

export default function AdminSettingsPage() {
  const { data, error, isLoading } = useGetAdminFlagsQuery();
  const [update, updateState] = useUpdateAdminFlagsMutation();
  const [flags, setFlags] = useState<AdminFlags | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { if (data) setFlags(data); }, [data]);

  const save = async () => {
    if (!flags) return;
    setMessage('');
    try {
      setFlags(await update(flags).unwrap());
      setMessage('Settings saved.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Global feature flags shared by the API, bot, and worker.</p></div>
      {isLoading && !flags ? <SettingsSkeleton /> : error && !flags ? <Card role="alert" className="p-6 text-sm text-destructive">{errorMessage(error)}</Card> : flags && (
        <Card className="max-w-3xl p-5">
          <div className="space-y-5">
            <FlagToggle label="Maintenance mode" description="Skip all welcome and goodbye posts while enabled." checked={flags.maintenance} onChange={(maintenance) => setFlags({ ...flags, maintenance })} />
            <FlagToggle label="Music" description="Global music feature flag." checked={flags.musicEnabled} onChange={(musicEnabled) => setFlags({ ...flags, musicEnabled })} />
            <FlagToggle label="Social" description="Global social feature flag." checked={flags.socialEnabled} onChange={(socialEnabled) => setFlags({ ...flags, socialEnabled })} />
            <label className="block border-t border-border pt-5">
              <span className="text-sm font-medium">Message rate per server per minute</span>
              <span className="mt-1 block text-xs text-muted-foreground">Set to zero to pause member-event posts without enabling maintenance.</span>
              <input type="number" min={0} max={1000} step={1} value={flags.messageRatePerMinute} onChange={(event) => setFlags({ ...flags, messageRatePerMinute: Number(event.target.value) })} className="mt-3 min-h-10 w-40 rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <p role={message && message !== 'Settings saved.' ? 'alert' : 'status'} className={`text-sm ${message === 'Settings saved.' ? 'text-success' : 'text-destructive'}`}>{message}</p>
              <button type="button" disabled={updateState.isLoading} onClick={() => void save()} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Save settings</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FlagToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4">
    <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 accent-primary" />
  </label>;
}

function SettingsSkeleton() {
  return <Card className="max-w-3xl space-y-6 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</Card>;
}
