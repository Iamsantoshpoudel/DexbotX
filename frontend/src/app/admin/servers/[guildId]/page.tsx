'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, Field, Skeleton } from '@/components/ui/misc';
import { Input, Select, Textarea } from '@/components/ui/input';
import { errorMessage, errorStatus } from '@/lib/errors';
import {
  useGetAdminMessageChannelsQuery,
  useGetGuildQuery,
} from '@/store/adminApi';

export default function AdminServerDetailPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [messageCardOpen, setMessageCardOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const { data: detail, error: detailError, isLoading: detailLoading } = useGetGuildQuery(guildId, { skip: !guildId });
  const {
    data: messageChannels,
    error: channelsError,
    isFetching: channelsFetching,
  } = useGetAdminMessageChannelsQuery(guildId, {
    skip: !guildId || !messageCardOpen,
    refetchOnMountOrArgChange: 60,
  });
  const [sending, setSending] = useState(false);

  const selectedChannel = useMemo(
    () => messageChannels?.channels.find((channel) => channel.id === (selectedChannelId ?? messageChannels.defaultChannelId)),
    [messageChannels, selectedChannelId],
  );
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const openConfirmation = () => {
    if (!detail || !content.length || !selectedChannel || sending || cooldownSeconds > 0) return;
    setConfirmation('');
    setConfirmOpen(true);
  };

  const submitMessage = async () => {
    if (!detail || !selectedChannel || confirmation !== detail.guild.name || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/admin/guilds/${encodeURIComponent(guildId)}/message`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(selectedChannel.id !== messageChannels?.defaultChannelId ? { channelId: selectedChannel.id } : {}),
          content,
          ...(embedTitle || embedDescription
            ? { embed: { ...(embedTitle ? { title: embedTitle } : {}), ...(embedDescription ? { description: embedDescription } : {}) } }
            : {}),
        }),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) throw new AdminMessageRequestError(response.status, responseBody, response);
      toast.success(`Message sent to #${selectedChannel.name}.`);
      setContent('');
      setEmbedTitle('');
      setEmbedDescription('');
      setConfirmOpen(false);
      setConfirmation('');
    } catch (error) {
      const status = errorStatus(error);
      if (status === 429) {
        const data = error instanceof AdminMessageRequestError ? error.data : undefined;
        const header = error instanceof AdminMessageRequestError
          ? error.response.headers.get('Retry-After')
          : null;
        const retryAfterValue = data && typeof data === 'object' && 'retryAfter' in data
          ? data.retryAfter
          : undefined;
        const retryAfter = typeof retryAfterValue === 'number'
          ? retryAfterValue
          : Number(header ?? 30);
        const cooldown = Number.isFinite(retryAfter) ? Math.max(1, retryAfter) : 30;
        setCooldownUntil(Date.now() + cooldown * 1000);
        setNow(Date.now());
        toast.error(`Message limit reached. Try again in ${Math.ceil(cooldown)} seconds.`);
      } else {
        toast.error(adminMessageError(error));
      }
    } finally {
      setSending(false);
    }
  };

  if (detailLoading && !detail) {
    return <div className="space-y-5"><Skeleton className="h-8 w-64" /><Skeleton className="h-36 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (detailError || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/admin/servers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" />Servers</Link>
        <Card role="alert" className="p-5 text-sm text-destructive">{errorMessage(detailError, 'Server details are unavailable.')}</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/servers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" />Servers</Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Server details</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{detail.guild.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{detail.guild.id}</p>
      </div>

      <Card className="grid gap-4 p-5 text-sm sm:grid-cols-3">
        <p><span className="text-muted-foreground">Members:</span> {detail.guild.memberCount.toLocaleString('en-US')}</p>
        <p><span className="text-muted-foreground">Owner ID:</span> <span className="font-mono">{detail.guild.ownerId ?? '—'}</span></p>
        <p><span className="text-muted-foreground">Installed:</span> {new Date(detail.guild.joinedAt).toLocaleDateString()}</p>
      </Card>

      <Card className="overflow-hidden">
        <button
          type="button"
          aria-expanded={messageCardOpen}
          aria-controls="admin-send-message-form"
          onClick={() => setMessageCardOpen((open) => !open)}
          className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left hover:bg-muted/40"
        >
          <span>
            <span className="block font-semibold">Send a message</span>
            <span className="mt-1 block text-sm text-muted-foreground">Send a one-time message as DexBotX to this server.</span>
          </span>
          {messageCardOpen ? <ChevronUp aria-hidden className="size-5 shrink-0" /> : <ChevronDown aria-hidden className="size-5 shrink-0" />}
        </button>

        {messageCardOpen && (
          <div id="admin-send-message-form" className="grid gap-6 border-t border-border p-5 lg:grid-cols-2">
            <div className="space-y-4">
              {channelsFetching && !messageChannels ? <Skeleton className="h-12 w-full" /> : channelsError ? (
                <p role="alert" className="text-sm text-destructive">{errorMessage(channelsError, 'Channels are unavailable.')}</p>
              ) : (
                <Field label="Channel" htmlFor="admin-message-channel" hint="Only text and announcement channels are listed.">
                  <Select
                    id="admin-message-channel"
                    value={selectedChannel?.id ?? ''}
                    disabled={!messageChannels?.channels.length || sending}
                    onChange={(event) => setSelectedChannelId(event.target.value)}
                  >
                    {messageChannels?.channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.isDefault ? `Default — #${channel.name}` : `#${channel.name}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="Message" htmlFor="admin-message-content" counter={`${content.length}/2000`}>
                <Textarea
                  id="admin-message-content"
                  value={content}
                  maxLength={2000}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write the message to send…"
                  className="min-h-32"
                />
              </Field>

              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Optional embed</summary>
                <div className="mt-4 space-y-4">
                  <Field label="Embed title" htmlFor="admin-message-embed-title" counter={`${embedTitle.length}/256`}>
                    <Input id="admin-message-embed-title" value={embedTitle} maxLength={256} onChange={(event) => setEmbedTitle(event.target.value)} />
                  </Field>
                  <Field label="Embed description" htmlFor="admin-message-embed-description" counter={`${embedDescription.length}/4000`}>
                    <Textarea id="admin-message-embed-description" value={embedDescription} maxLength={4000} onChange={(event) => setEmbedDescription(event.target.value)} />
                  </Field>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!messageChannels || !selectedChannel || !content.length || sending || cooldownSeconds > 0}
                  onClick={openConfirmation}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send aria-hidden className="size-4" />
                  {sending ? 'Sending…' : cooldownSeconds ? `Try again in ${cooldownSeconds}s` : 'Send'}
                </button>
                <span className="text-xs text-muted-foreground">Mentions are disabled.</span>
              </div>
            </div>

            <section aria-label="Message preview">
              <h2 className="mb-2 text-sm font-semibold">Preview</h2>
              <div className="min-h-44 rounded-lg bg-[#313338] p-4 text-[#dbdee1]">
                <div className="flex items-start gap-3">
                  <div aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[#5865f2] text-xs font-bold text-white">DB</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">DexBotX <span className="ml-1 rounded bg-[#5865f2] px-1 py-0.5 text-[9px] font-bold uppercase">Bot</span></p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{content || <span className="text-[#949ba4]">Your message will appear here…</span>}</p>
                    {(embedTitle || embedDescription) && (
                      <div className="mt-2 max-w-md rounded border-l-4 border-[#5865f2] bg-[#2b2d31] px-3 py-2">
                        {embedTitle && <p className="font-semibold text-white">{embedTitle}</p>}
                        {embedDescription && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{embedDescription}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </Card>

      {confirmOpen && selectedChannel && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="admin-message-confirm-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h2 id="admin-message-confirm-title" className="text-lg font-semibold">Confirm message</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Send this message to <span className="font-medium text-foreground">{detail.guild.name}</span> in <span className="font-medium text-foreground">#{selectedChannel.name}</span>?
            </p>
            <div className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-muted p-3 text-sm">
              <p className="whitespace-pre-wrap break-words">{content}</p>
              {(embedTitle || embedDescription) && (
                <div className="mt-3 border-l-4 border-primary pl-3">
                  {embedTitle && <p className="font-semibold">{embedTitle}</p>}
                  {embedDescription && <p className="mt-1 whitespace-pre-wrap break-words">{embedDescription}</p>}
                </div>
              )}
            </div>
            <label htmlFor="admin-message-confirm-name" className="mt-4 block text-sm">
              Type <span className="font-semibold">{detail.guild.name}</span> to confirm
            </label>
            <Input
              id="admin-message-confirm-name"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2"
              autoComplete="off"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={sending} onClick={() => setConfirmOpen(false)} className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Cancel</button>
              <button
                type="button"
                disabled={sending || confirmation !== detail.guild.name || cooldownSeconds > 0}
                onClick={() => void submitMessage()}
                className="min-h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Confirm and send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function adminMessageError(error: unknown): string {
  const rawData = error instanceof AdminMessageRequestError ? error.data : undefined;
  const code = rawData && typeof rawData === 'object' && 'code' in rawData ? rawData.code : undefined;
  if (code === 'CANNOT_POST') return 'DexBotX cannot post in that channel. Check its channel permissions.';
  if (errorStatus(error) === 400) return 'That message or channel is invalid. Check the form and try again.';
  if (errorStatus(error) === 404) return 'The server or channel could not be found.';
  return errorMessage(error, 'The message could not be sent. Please try again.');
}

class AdminMessageRequestError extends Error {
  constructor(
    readonly status: number,
    readonly data: unknown,
    readonly response: Response,
  ) {
    super('Admin message request failed');
  }
}
