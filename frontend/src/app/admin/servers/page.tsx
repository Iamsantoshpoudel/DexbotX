'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/errors';
import {
  useDisableGuildMutation,
  useGetGuildQuery,
  useGetGuildsQuery,
  useLeaveGuildMutation,
  useResyncGuildMutation,
} from '@/store/adminApi';

type GuildAction = 'resync' | 'disable' | 'leave';

export default function AdminServersPage() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<GuildAction | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading, isFetching } = useGetGuildsQuery({ search, page });
  const { data: detail, isFetching: detailFetching, error: detailError } = useGetGuildQuery(selectedId ?? '', { skip: !selectedId });
  const [resyncGuild] = useResyncGuildMutation();
  const [disableGuild] = useDisableGuildMutation();
  const [leaveGuild] = useLeaveGuildMutation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  const closeDialog = () => {
    setAction(null);
    setConfirmation('');
    setActionError('');
  };

  const runAction = async () => {
    if (!selectedId || !action || busy) return;
    setBusy(true);
    setActionError('');
    try {
      if (action === 'resync') await resyncGuild(selectedId).unwrap();
      if (action === 'disable') await disableGuild(selectedId).unwrap();
      if (action === 'leave') {
        await leaveGuild({ id: selectedId, confirm: confirmation }).unwrap();
        setSelectedId(null);
      }
      closeDialog();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Servers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Installed guilds and their welcome/goodbye configuration.</p>
        </div>
        <span className="text-xs text-muted-foreground" aria-live="polite">{isFetching ? 'Refreshing…' : `${(data?.total ?? 0).toLocaleString('en-US')} servers`}</span>
      </div>

      <label className="relative block max-w-xl">
        <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">Search servers by name or ID</span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search by server name or ID"
          className="min-h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {error && !data ? (
        <Card role="alert" className="p-6"><h2 className="font-semibold">Servers unavailable</h2><p className="mt-2 text-sm text-muted-foreground">{errorMessage(error)}</p></Card>
      ) : isLoading && !data ? (
        <ServersSkeleton />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Server</th>
                  <th scope="col" className="px-4 py-3 font-medium">Members</th>
                  <th scope="col" className="px-4 py-3 font-medium">Owner ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Welcome</th>
                  <th scope="col" className="px-4 py-3 font-medium">Goodbye</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.guilds.length ? data.guilds.map((guild) => (
                  <tr key={guild.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(guild.id)}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/servers/${encodeURIComponent(guild.id)}`}
                        onClick={(event) => event.stopPropagation()}
                        className="text-left font-medium text-primary hover:underline"
                      >
                        {guild.name}
                        <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">{guild.id}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{guild.memberCount.toLocaleString('en-US')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{guild.ownerId ?? '—'}</td>
                    <td className="px-4 py-3"><Enabled value={guild.welcomeEnabled} /></td>
                    <td className="px-4 py-3"><Enabled value={guild.goodbyeEnabled} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{guild.lastMessageAt ? timeAgo(guild.lastMessageAt) : 'Never'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No installed servers match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">Page {data?.page ?? page} of {Math.max(1, data?.pages ?? 1)}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-border px-3 text-xs disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= (data?.pages ?? 1) || isFetching} onClick={() => setPage((value) => value + 1)} className="min-h-9 rounded-lg border border-border px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        </Card>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <aside role="dialog" aria-modal="true" aria-labelledby="guild-detail-title" className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Server details</p><h2 id="guild-detail-title" className="mt-1 text-xl font-semibold">{detail?.guild.name ?? 'Loading server'}</h2></div>
              <button type="button" aria-label="Close server details" onClick={() => setSelectedId(null)} className="grid size-10 place-items-center rounded-lg border border-border hover:bg-muted"><X aria-hidden className="size-4" /></button>
            </div>
            {detailFetching && !detail ? <div className="mt-6 space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /></div>
              : detailError ? <p role="alert" className="mt-6 text-sm text-destructive">{errorMessage(detailError)}</p>
                : detail && (
                  <div className="mt-6 space-y-6">
                    <Card className="space-y-2 p-4 text-sm">
                      <p><span className="text-muted-foreground">Guild ID:</span> <span className="font-mono">{detail.guild.id}</span></p>
                      <p><span className="text-muted-foreground">Owner ID:</span> <span className="font-mono">{detail.guild.ownerId ?? '—'}</span></p>
                      <p><span className="text-muted-foreground">Members:</span> {detail.guild.memberCount.toLocaleString('en-US')}</p>
                      <p><span className="text-muted-foreground">Installed:</span> {new Date(detail.guild.joinedAt).toLocaleString()}</p>
                      <p><span className="text-muted-foreground">Last message:</span> {detail.guild.lastMessageAt ? timeAgo(detail.guild.lastMessageAt) : 'Never'}</p>
                    </Card>
                    <section>
                      <h3 className="mb-3 font-semibold">Configured channels</h3>
                      <div className="space-y-2">
                        {detail.channels.map((channel) => (
                          <Card key={channel.kind} className="flex items-center justify-between gap-3 p-4 text-sm">
                            <div><p className="font-medium capitalize">{channel.kind}</p><p className="mt-1 text-xs text-muted-foreground">{channel.channelName ? `#${channel.channelName}` : 'No channel configured'} · {channel.enabled ? 'Enabled' : 'Disabled'}</p></div>
                            <span className={channel.canBotPost === null ? 'text-muted-foreground' : channel.canBotPost ? 'text-success' : 'text-destructive'}>{channel.canBotPost === null ? 'Not checked' : channel.canBotPost ? 'Bot can post' : 'Bot cannot post'}</span>
                          </Card>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h3 className="mb-3 font-semibold">Recent errors</h3>
                      <div className="space-y-2">
                        {detail.recentErrors.length ? detail.recentErrors.map((item, index) => (
                          <Card key={`${item.at}-${index}`} className="p-3 text-sm">
                            <p className="font-medium capitalize">{item.kind ?? 'Message'} · {item.reason ?? 'Unknown error'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.at ? new Date(item.at).toLocaleString() : 'Time unavailable'}</p>
                          </Card>
                        )) : <p className="text-sm text-muted-foreground">No recent message errors.</p>}
                      </div>
                    </section>
                    <section>
                      <h3 className="mb-3 font-semibold">Actions</h3>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setAction('resync')} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-muted">Resync cache</button>
                        <button type="button" onClick={() => setAction('disable')} className="min-h-10 rounded-lg border border-border px-3 text-sm hover:bg-muted">Disable welcome/goodbye</button>
                        <button type="button" onClick={() => setAction('leave')} className="min-h-10 rounded-lg border border-destructive/50 px-3 text-sm text-destructive hover:bg-destructive/10">Make bot leave</button>
                      </div>
                    </section>
                  </div>
                )}
          </aside>
        </div>
      )}

      {action && detail && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="guild-action-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h2 id="guild-action-title" className="text-lg font-semibold">{actionTitle(action)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{actionDescription(action, detail.guild.name)}</p>
            {action === 'leave' && (
              <label className="mt-4 block text-sm">
                Type <span className="font-semibold">{detail.guild.name}</span> to confirm
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              </label>
            )}
            {actionError && <p role="alert" className="mt-3 text-sm text-destructive">{actionError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={closeDialog} className="min-h-10 rounded-lg border border-border px-3 text-sm">Cancel</button>
              <button
                type="button"
                disabled={busy || (action === 'leave' && confirmation !== detail.guild.name)}
                onClick={() => void runAction()}
                className="min-h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Enabled({ value }: { value: boolean }) {
  return <span className={value ? 'text-success' : 'text-muted-foreground'}>{value ? 'Enabled' : 'Disabled'}</span>;
}

function ServersSkeleton() {
  return <Card className="overflow-hidden p-4"><Skeleton className="h-10 w-full" /><div className="mt-3 space-y-2">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div></Card>;
}

function actionTitle(action: GuildAction): string {
  if (action === 'resync') return 'Resync server cache?';
  if (action === 'disable') return 'Disable welcome and goodbye?';
  return 'Make the bot leave this server?';
}

function actionDescription(action: GuildAction, name: string): string {
  if (action === 'resync') return `Clear cached server and channel data for ${name}.`;
  if (action === 'disable') return `Both automated messages will be disabled for ${name}.`;
  return `DexBotX will leave ${name}. This action cannot be undone here.`;
}

function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
