import { Bell, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge, Card, Field } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { DiscordMessageMock, PageHeader, PreviewBanner } from './ui';

const PLATFORMS = ['Video platform', 'Live streaming', 'Short-form video'];
const POST_CHANNELS = ['Sample creator feed', 'Sample announcements'];
const MENTION_ROLES = ['Sample notification role', 'No role'];
const NOTIFICATIONS = [
  { platform: 'Video platform', name: 'Sample Creator', detail: 'New uploads · Sample creator feed' },
  { platform: 'Live streaming', name: 'Sample Streamer', detail: 'Stream alerts · Sample announcements' },
  { platform: 'Short-form video', name: 'Sample Channel', detail: 'New posts · Sample creator feed' },
];

export function SocialPreview() {
  return (
    <>
      <PageHeader title="Social notifications" description="Connect creator feeds and choose where updates appear." />
      <PreviewBanner />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-5">
          <div className="flex items-center gap-2"><Plus aria-hidden="true" className="size-5 text-primary" /><h2 className="text-lg font-semibold">Add a notification</h2></div>
          <div className="mt-5 space-y-4">
            <Field label="Platform"><Select aria-label="Platform" aria-disabled="true" disabled defaultValue={PLATFORMS[0]} className="h-11">{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Channel name or link"><Input aria-label="Channel name or link" aria-disabled="true" disabled placeholder="Sample Creator" className="h-11" /></Field>
            <Field label="Post in"><Select aria-label="Post in" aria-disabled="true" disabled defaultValue={POST_CHANNELS[0]} className="h-11">{POST_CHANNELS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Mention role"><Select aria-label="Mention role" aria-disabled="true" disabled defaultValue={MENTION_ROLES[0]} className="h-11">{MENTION_ROLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Message">
              <Textarea aria-label="Message" aria-disabled="true" disabled placeholder="New post from {creator}: {title} {url} {role}" className="min-h-28" />
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Available message placeholders">
                {['{creator}', '{title}', '{url}', '{role}'].map((token) => <span key={token} className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">{token}</span>)}
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled aria-disabled="true" className="min-h-11"><Plus aria-hidden="true" />Add notification</Button>
              <Button type="button" variant="outline" disabled aria-disabled="true" className="min-h-11"><Send aria-hidden="true" />Send test</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2"><Bell aria-hidden="true" className="size-5 text-primary" /><h2 className="text-lg font-semibold">Active notifications</h2></div>
            <ul className="mt-4 divide-y divide-border">
              {NOTIFICATIONS.map((item) => (
                <li key={item.name} className="flex min-h-16 items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{item.name}</p><Badge className="rounded-md">{item.platform}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Switch aria-label={`Enable ${item.name} notification`} aria-disabled="true" disabled defaultChecked />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Preview</h2>
            <DiscordMessageMock />
          </Card>
        </div>
      </div>
    </>
  );
}