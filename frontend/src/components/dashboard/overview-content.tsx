'use client';

import { Bell, CircleCheck, FileText, Music, ShieldCheck, UserPlus, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/misc';
import { useGetChannelsQuery, useGetGuildQuery } from '@/store/api';
import { OverviewSkeleton } from './loading-skeleton';
import { ModuleCard, PageHeader, StatusPill } from './ui';

export function OverviewContent({ guildId }: { guildId: string }) {
  const { data, isLoading } = useGetGuildQuery(guildId);
  const { data: channels } = useGetChannelsQuery(guildId);

  if (isLoading || !data) {
    return <OverviewSkeleton />;
  }

  const channelName = (channelId: string | null) => {
    if (!channelId) return 'No channel selected';
    const channel = channels?.find((candidate) => candidate.id === channelId);
    return channel ? `#${channel.name}` : channels ? 'Channel unavailable' : 'Loading channel';
  };
  const welcome = data.settings.welcome;
  const goodbye = data.settings.goodbye;

  return (
    <>
      <PageHeader title="Overview" description="Your server modules at a glance." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard title="Welcome messages" description={channelName(welcome.channelId)} icon={UserPlus} status={<StatusPill on={welcome.enabled} />} href={`/dashboard/${guildId}/welcome`} actionLabel="Configure" />
        <ModuleCard title="Goodbye messages" description={channelName(goodbye.channelId)} icon={LogOut} status={<StatusPill on={goodbye.enabled} />} href={`/dashboard/${guildId}/goodbye`} actionLabel="Configure" />
        <Card className="flex min-h-52 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-muted text-success"><CircleCheck aria-hidden="true" className="size-5" /></div>
            <span className="inline-flex items-center gap-2 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success"><span className="size-1.5 rounded-full bg-success" />Online</span>
          </div>
          <h2 className="mt-4 font-semibold">Bot status</h2>
          <p className="mt-1 text-sm text-muted-foreground">{data.guild.memberCount.toLocaleString('en-US')} members in this server</p>
        </Card>
        <ModuleCard title="Music" description="A dedicated listening experience for your server." icon={Music} status={<span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Preview</span>} href={`/dashboard/${guildId}/music`} actionLabel="Open preview" />
        <ModuleCard title="Social notifications" description="Keep your community up to date with creator posts." icon={Bell} status={<span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Preview</span>} href={`/dashboard/${guildId}/social`} actionLabel="Open preview" />
        <ModuleCard title="Auto moderation" description="Coming soon" icon={ShieldCheck} muted />
        <ModuleCard title="Logging" description="Coming soon" icon={FileText} muted />
      </div>
    </>
  );
}