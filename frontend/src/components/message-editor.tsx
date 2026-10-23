'use client';

import { Hash, RotateCcw, Save, Send, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { BackgroundUpload } from '@/components/editor/background-upload';
import { ColorField } from '@/components/editor/color-field';
import { PlaceholderChips } from '@/components/editor/placeholder-chips';
import { PresetsBar } from '@/components/editor/presets-bar';
import { StylePicker } from '@/components/editor/style-picker';
import { DiscordPreview } from '@/components/preview/discord-preview';
import { useCardPreview } from '@/components/preview/use-card-preview';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/ui';
import { EditorSkeleton } from '@/components/dashboard/loading-skeleton';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge, Card, Field } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { errorBody, errorMessage, isRateLimited, issuesByPath } from '@/lib/errors';
import { FIELD_IDS, validateMessage } from '@/lib/message-schema';
import type { PlaceholderContext } from '@/lib/placeholders';
import { readChannelsCache, writeChannelsCache } from '@/lib/server-cache';
import type { Channel, MessageKind, Preset } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  useGetChannelsQuery,
  useGetGuildQuery,
  useGetMeQuery,
  useGetPresetsQuery,
  useResetMessageMutation,
  useSaveMessageMutation,
  useSendTestMutation,
} from '@/store/api';
import { applyPreset, discard, isDirty, load, markSaved, patch, patchEmbed, patchImage } from '@/store/editorSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const COPY: Record<MessageKind, { title: string; blurb: string }> = {
  welcome: { title: 'Welcome message', blurb: 'Sent when someone joins your server.' },
  goodbye: { title: 'Goodbye message', blurb: 'Sent when someone leaves your server.' },
};

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ToggleRow({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function MessageEditor({ guildId, kind }: { guildId: string; kind: MessageKind }) {
  const key = `${guildId}:${kind}`;
  const dispatch = useAppDispatch();

  const { data, isLoading } = useGetGuildQuery(guildId);
  const { data: channels } = useGetChannelsQuery(guildId);
  const { data: presets } = useGetPresetsQuery();
  const { data: me } = useGetMeQuery();
  const [cachedChannels, setCachedChannels] = useState<{ key: string; value: Channel[] } | null>(null);
  const channelCacheKey = me ? `${me.id}:${guildId}` : '';

  useEffect(() => {
    if (!me) return;
    const cached = readChannelsCache(me.id, guildId);
    setCachedChannels(cached ? { key: channelCacheKey, value: cached } : null);
  }, [channelCacheKey, guildId, me]);

  useEffect(() => {
    if (!me || !channels) return;
    writeChannelsCache(me.id, guildId, channels);
    setCachedChannels({ key: channelCacheKey, value: channels });
  }, [channelCacheKey, channels, guildId, me]);

  const visibleChannels = channels ?? (cachedChannels?.key === channelCacheKey ? cachedChannels.value : undefined);

  const draft = useAppSelector((s) => (s.editor.key === key ? s.editor.draft : null));
  const dirty = useAppSelector((s) => s.editor.key === key && isDirty(s.editor));
  const [save, { isLoading: saving }] = useSaveMessageMutation();
  const [reset, { isLoading: resetting }] = useResetMessageMutation();
  const [sendTest, { isLoading: testing }] = useSendTestMutation();
  const [issues, setIssues] = useState<Record<string, string>>({});
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Load server data into the editor. The reducer never clobbers unsaved edits.
  useEffect(() => {
    if (data) dispatch(load({ key, config: data.settings[kind] }));
  }, [data, key, kind, dispatch]);
  useEffect(() => setIssues({}), [key]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const card = useCardPreview(
    guildId,
    kind,
    draft?.image ?? null,
    data?.imageKeys[kind] ?? null,
    data?.assetHashes.avatar ?? null,
    data?.assetHashes.banner ?? null,
  );

  const ctx = useMemo<PlaceholderContext>(
    () => ({
      userId: me?.id ?? '0',
      username: me?.username ?? 'newmember',
      displayName: me?.globalName ?? me?.username ?? 'New Member',
      serverName: data?.guild.name ?? 'Your Server',
      memberCount: Math.max(data?.guild.memberCount ?? 1, 1),
    }),
    [me, data],
  );

  // Instant, field-level feedback from the same rules the server enforces.
  const problems = useMemo(() => (draft ? validateMessage(draft) : {}), [draft]);
  const hasProblems = Object.keys(problems).length > 0;
  const copy = COPY[kind];

  if (isLoading || !data || !draft) {
    return <EditorSkeleton title={copy.title} description={copy.blurb} />;
  }

  const channel = visibleChannels?.find((c) => c.id === draft.channelId) ?? null;
  const savedChannelMissing = !!visibleChannels && !!draft.channelId && !channel;
  const grouped = Object.entries(
    (visibleChannels ?? []).reduce<Record<string, Channel[]>>((acc, c) => {
      const k = c.category ?? 'No category';
      (acc[k] ??= []).push(c);
      return acc;
    }, {}),
  );
  // Server-side issues win over local ones; both use the same dotted field paths.
  const err = (path: string): string | undefined => issues[path] ?? problems[path];
  /** aria wiring for a field: invalid state plus a pointer to its error message (rendered by <Field>). */
  const a11y = (path: string, id: string) => ({ 'aria-invalid': !!err(path), 'aria-describedby': err(path) ? `${id}-error` : undefined });
  const focusFirst = (found: Record<string, string>) => {
    const first = Object.keys(found).find((k) => FIELD_IDS[k]);
    if (first) document.getElementById(FIELD_IDS[first]!)?.focus();
  };

  function insertAtCursor(token: string) {
    const el = contentRef.current;
    const value = draft!.content;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    dispatch(patch({ content: value.slice(0, start) + token + value.slice(end) }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function onSave() {
    setIssues({});
    const local = validateMessage(draft!);
    if (Object.keys(local).length) {
      setIssues(local);
      toast.error('Fix the highlighted fields and try again.');
      focusFirst(local);
      return;
    }
    try {
      const saved = await save({ guildId, kind, config: draft! }).unwrap();
      dispatch(markSaved(saved.config));
      toast.success(`${copy.title} saved`);
    } catch (e) {
      if (isRateLimited(e)) return; // the shared baseQuery already showed the wait time
      const body = errorBody(e);
      const byPath = issuesByPath(body);
      if (Object.keys(byPath).length) {
        setIssues(byPath);
        focusFirst(byPath);
        toast.error('Fix the highlighted fields and try again.');
      } else {
        toast.error(errorMessage(e, 'Could not save. Try again.'));
      }
    }
  }

  async function onTest() {
    try {
      const res = await sendTest({ guildId, kind }).unwrap();
      const name = visibleChannels?.find((c) => c.id === res.channelId)?.name;
      toast.success(name ? `Test message sent to #${name}` : 'Test message sent');
    } catch (e) {
      if (isRateLimited(e)) return;
      toast.error(errorMessage(e, 'Could not send the test message.'));
    }
  }

  async function onReset() {
    if (!window.confirm(`Reset the saved ${kind} message to its defaults? Unsaved edits will be discarded.`)) return;
    try {
      const saved = await reset({ guildId, kind }).unwrap();
      dispatch(markSaved(saved.config));
      toast.success(`${copy.title} reset to defaults`);
    } catch (e) {
      if (isRateLimited(e)) return;
      toast.error(errorMessage(e, 'Could not reset this message.'));
    }
  }

  function onPreset(p: Preset) {
    dispatch(applyPreset(p.config));
    toast(`Applied “${p.name}”. Save to keep it.`);
  }

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.blurb}
        right={
          <>
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onReset} disabled={resetting || saving}>
              <RotateCcw /> {resetting ? 'Resetting…' : 'Reset'}
            </Button>
            <Badge tone={draft.enabled ? 'success' : 'neutral'}>{draft.enabled ? 'On' : 'Off'}</Badge>
            <Switch aria-label={`Enable ${kind} message`} checked={draft.enabled} onCheckedChange={(enabled) => dispatch(patch({ enabled }))} />
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="space-y-4 pb-24">
        <Card className="p-5">
            <Field label="Channel" htmlFor="channel" error={err('channelId')} hint="Where DexbotX posts this message.">
              <Select id="channel" value={draft.channelId ?? ''} {...a11y('channelId', 'channel')} onChange={(e) => dispatch(patch({ channelId: e.target.value || null }))}>
                <option value="">{visibleChannels ? 'Select a channel…' : 'Loading channels…'}</option>
                {grouped.map(([category, list]) => (
                  <optgroup key={category} label={category}>
                    {list!.map((c) => (
                      <option key={c.id} value={c.id}>
                        # {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            {savedChannelMissing && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                <TriangleAlert className="size-3.5" /> The channel saved before no longer exists. Pick another one.
              </p>
            )}
        </Card>

        <Section title="Start from a preset" description="Replaces the text, embed and card below. Your channel and on/off setting stay.">
          <PresetsBar presets={presets?.filter((p) => p.kind === kind)} onApply={onPreset} />
        </Section>

        <Section title="Message text" description="Plain text above the card. Supports Discord formatting like **bold** and *italic*.">
          <div className="space-y-3">
            <Field label="Text" htmlFor="content" counter={`${draft.content.length}/2000`} error={err('content')}>
              <Textarea ref={contentRef} id="content" value={draft.content} maxLength={2000} {...a11y('content', 'content')} onChange={(e) => dispatch(patch({ content: e.target.value }))} placeholder="Welcome to {server}, {user}!" />
            </Field>
            <PlaceholderChips onInsert={insertAtCursor} />
          </div>
        </Section>

        <Section
          title="Image card"
          description="A picture with the member's avatar, drawn when they join."
          action={<Switch aria-label="Enable image card" checked={draft.image.enabled} onCheckedChange={(enabled) => dispatch(patchImage({ enabled }))} />}
        >
          <div className={cn('space-y-4', !draft.image.enabled && 'pointer-events-none opacity-45')} aria-disabled={!draft.image.enabled}>
            <Field label="Style">
              <StylePicker value={draft.image.style} onChange={(style) => dispatch(patchImage({ style }))} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Small heading" htmlFor="img-title" counter={`${draft.image.title.length}/40`} error={err('image.title')}>
                <Input id="img-title" value={draft.image.title} maxLength={40} {...a11y('image.title', 'img-title')} onChange={(e) => dispatch(patchImage({ title: e.target.value }))} />
              </Field>
              <Field label="Accent colour" htmlFor="img-accent" error={err('image.accentColor')}>
                <ColorField id="img-accent" value={draft.image.accentColor} onChange={(accentColor) => dispatch(patchImage({ accentColor }))} />
              </Field>
            </div>
            <Field label="Subtitle" htmlFor="img-sub" counter={`${draft.image.subtitle.length}/100`} error={err('image.subtitle')} hint="The member's name is shown big in the middle automatically.">
              <Input id="img-sub" value={draft.image.subtitle} maxLength={100} {...a11y('image.subtitle', 'img-sub')} onChange={(e) => dispatch(patchImage({ subtitle: e.target.value }))} />
            </Field>
            <Field label="Avatar shape">
              <div role="radiogroup" aria-label="Avatar shape" className="inline-flex rounded-lg border border-border bg-input p-1">
                {(['circle', 'rounded'] as const).map((shape) => (
                  <button key={shape} type="button" role="radio" aria-checked={draft.image.avatarShape === shape} onClick={() => dispatch(patchImage({ avatarShape: shape }))} className={cn('rounded-md px-4 py-1.5 text-sm capitalize transition-colors', draft.image.avatarShape === shape ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {shape}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Custom background" hint="Optional. Replaces the style gradient and the server banner.">
              <BackgroundUpload guildId={guildId} path={draft.image.backgroundPath} onChange={(backgroundPath) => dispatch(patchImage({ backgroundPath }))} />
            </Field>
            <ToggleRow id="img-count" label="Show member count" hint="A small pill with the total number of members." checked={draft.image.showMemberCount} onChange={(showMemberCount) => dispatch(patchImage({ showMemberCount }))} />
            <ToggleRow
              id="img-banner"
              label="Use my server banner as background"
              hint={
                draft.image.backgroundPath
                  ? 'A custom background is set, so it is used instead of the banner.'
                  : data.guild.bannerUrl
                    ? 'Your server banner replaces the gradient.'
                    : 'This server has no banner (needs Server Boost level 2). The gradient is used instead.'
              }
              checked={draft.image.useServerBanner}
              onChange={(useServerBanner) => dispatch(patchImage({ useServerBanner }))}
              disabled={!data.guild.bannerUrl || !!draft.image.backgroundPath}
            />
          </div>
        </Section>

        <Section
          title="Embed"
          description="A styled box. When on, the card appears inside it."
          action={<Switch aria-label="Enable embed" checked={draft.embed.enabled} onCheckedChange={(enabled) => dispatch(patchEmbed({ enabled }))} />}
        >
          <div className={cn('space-y-4', !draft.embed.enabled && 'pointer-events-none opacity-45')} aria-disabled={!draft.embed.enabled}>
            <Field label="Title" htmlFor="emb-title" counter={`${draft.embed.title.length}/256`} error={err('embed.title')}>
              <Input id="emb-title" value={draft.embed.title} maxLength={256} {...a11y('embed.title', 'emb-title')} onChange={(e) => dispatch(patchEmbed({ title: e.target.value }))} />
            </Field>
            <Field label="Description" htmlFor="emb-desc" counter={`${draft.embed.description.length}/2000`} error={err('embed.description')} hint="Variables like {displayName} and {memberCountOrdinal} work here too.">
              <Textarea id="emb-desc" value={draft.embed.description} maxLength={2000} {...a11y('embed.description', 'emb-desc')} onChange={(e) => dispatch(patchEmbed({ description: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Colour" htmlFor="emb-color" error={err('embed.color')}>
                <ColorField id="emb-color" value={draft.embed.color} onChange={(color) => dispatch(patchEmbed({ color }))} />
              </Field>
              <Field label="Footer" htmlFor="emb-footer" counter={`${draft.embed.footer.length}/200`} error={err('embed.footer')}>
                <Input id="emb-footer" value={draft.embed.footer} maxLength={200} {...a11y('embed.footer', 'emb-footer')} onChange={(e) => dispatch(patchEmbed({ footer: e.target.value }))} />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Live preview</h2>
          {!draft.enabled && <Badge tone="warning">Not sending yet</Badge>}
        </div>
        <DiscordPreview config={draft} ctx={ctx} channelName={channel?.name ?? null} card={card} />
        <Button variant="secondary" className="w-full" onClick={onTest} disabled={testing || dirty || !data.settings[kind].channelId}>
          <Send /> {testing ? 'Sending…' : 'Send test to channel'}
        </Button>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Hash className="mt-0.5 size-3.5 shrink-0" />
          {dirty ? 'Save your changes first. The test sends the saved version, using your own avatar.' : data.settings[kind].channelId ? 'Sends the saved version to your channel, using your own avatar.' : 'Pick a channel and save to enable test messages.'}
        </p>
      </aside>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4" aria-live="polite">
        <div className={cn('pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur transition-all', dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}>
          <span className="text-sm">Unsaved changes</span>
          <Button variant="ghost" size="sm" onClick={() => dispatch(discard())} disabled={saving || resetting}>
            <RotateCcw /> Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || hasProblems}>
            <Save /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
