'use client';

import { useState } from 'react';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import { useDeleteAdminBackgroundMutation, useGetAdminContentQuery } from '@/store/adminApi';

export default function AdminContentPage() {
  const { data, error, isLoading } = useGetAdminContentQuery();
  const [deleteBackground, deleteState] = useDeleteAdminBackgroundMutation();
  const [actionError, setActionError] = useState('');

  const remove = async (path: string) => {
    if (!window.confirm(`Permanently delete background ${path}? This also clears it from the guild's settings.`)) return;
    setActionError('');
    try {
      await deleteBackground({ path, confirm: true }).unwrap();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Content</h1><p className="mt-1 text-sm text-muted-foreground">Preset usage and custom background storage.</p></div>
      {actionError && <Card role="alert" className="border-destructive/50 p-4 text-sm text-destructive">{actionError}</Card>}
      {isLoading && !data ? <ContentSkeleton /> : error && !data ? <Card role="alert" className="p-6 text-sm text-destructive">{errorMessage(error)}</Card> : (
        <>
          <Card className="overflow-hidden">
            <div className="border-b border-border p-4"><h2 className="font-semibold">Preset usage</h2></div>
            <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
              {data?.presetUsage.map((preset) => <div key={preset.id} className="flex items-center justify-between bg-card p-4"><span className="text-sm">{preset.name}</span><span className="font-mono text-sm tabular-nums">{preset.uses}</span></div>)}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-border p-4"><h2 className="font-semibold">Stored backgrounds</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-surface text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Path</th><th className="px-4 py-3 font-medium">Guild</th><th className="px-4 py-3 font-medium">Size</th><th className="px-4 py-3 font-medium">Uploaded</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data?.backgrounds.length ? data.backgrounds.map((background) => <tr key={background.path}>
                    <td className="px-4 py-3 font-mono text-xs">{background.path}</td><td className="px-4 py-3 font-mono text-xs">{background.guildId}</td>
                    <td className="px-4 py-3">{formatBytes(background.size)}</td><td className="px-4 py-3 text-muted-foreground">{background.uploadedAt ? new Date(background.uploadedAt).toLocaleString() : 'Unknown'}</td>
                    <td className="px-4 py-3"><button type="button" disabled={deleteState.isLoading} onClick={() => void remove(background.path)} className="min-h-9 rounded-lg border border-destructive/50 px-3 text-xs text-destructive disabled:opacity-50">Delete</button></td>
                  </tr>) : <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No custom backgrounds stored.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function ContentSkeleton() {
  return <div className="space-y-4"><Card className="space-y-3 p-4"><Skeleton className="h-6 w-36" />{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</Card><Card className="space-y-3 p-4"><Skeleton className="h-6 w-40" />{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</Card></div>;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return 'Unknown';
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
