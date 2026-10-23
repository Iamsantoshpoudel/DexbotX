import { ListMusic, Music2, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, Field } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { PageHeader, PreviewBanner } from './ui';

const VOICE_CHANNELS = ['Sample voice channel', 'Sample listening room'];
const REQUEST_CHANNELS = ['Sample music requests', 'Sample bot commands'];
const DJ_ROLES = ['Sample DJ role', 'No role required'];
const QUEUE_ITEMS = [
  { title: 'Sample track title', artist: 'Sample artist' },
  { title: 'Another sample track', artist: 'Sample artist' },
  { title: 'Third sample track', artist: 'Sample artist' },
];

function DisabledSwitch({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <Switch aria-label={label} aria-disabled="true" checked={checked} disabled />
    </div>
  );
}

function MusicSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <Field label={label}>
      <Select aria-label={label} aria-disabled="true" disabled defaultValue={options[0]} className="h-11">
        {options.map((option) => <option key={option}>{option}</option>)}
      </Select>
    </Field>
  );
}

export function MusicPreview() {
  return (
    <>
      <PageHeader title="Music" description="Playback controls and queue settings for your server." />
      <PreviewBanner />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Player settings</h2>
          <div className="mt-5 space-y-4">
            <MusicSelect label="Voice channel" options={VOICE_CHANNELS} />
            <MusicSelect label="Request channel" options={REQUEST_CHANNELS} />
            <MusicSelect label="DJ role" options={DJ_ROLES} />
            <Field label="Default volume">
              <div className="flex items-center gap-3">
                <Input aria-label="Default volume" aria-disabled="true" disabled type="range" min="0" max="100" defaultValue="70" className="h-11 px-0" />
                <span className="w-10 text-right text-sm text-muted-foreground">70%</span>
              </div>
            </Field>
            <Field label="Maximum queue size">
              <Input aria-label="Maximum queue size" aria-disabled="true" disabled type="number" defaultValue="50" className="h-11" />
            </Field>
            <div className="divide-y divide-border border-y border-border py-1">
              <DisabledSwitch label="Announce song changes" checked />
              <DisabledSwitch label="Leave when the voice channel is empty" checked />
              <DisabledSwitch label="Stay connected 24/7" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled aria-disabled="true" className="min-h-11">Save changes</Button>
              <Button type="button" variant="outline" disabled aria-disabled="true" className="min-h-11">Reset</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Music2 aria-hidden="true" className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Now playing</h2>
            </div>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row">
              <div className="grid aspect-square w-full max-w-40 shrink-0 place-items-center rounded-xl border border-border bg-muted text-muted-foreground" aria-label="Sample track artwork placeholder">
                <Music2 aria-hidden="true" className="size-10" />
              </div>
              <div className="min-w-0 flex-1 self-center">
                <h3 className="truncate text-lg font-semibold">Sample track title</h3>
                <p className="mt-1 text-sm text-muted-foreground">Sample artist</p>
                <div className="mt-5">
                  <div role="progressbar" aria-label="Sample track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={36} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[36%] bg-primary" /></div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>1:12</span><span>3:20</span></div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button type="button" variant="ghost" size="icon" aria-label="Previous track" aria-disabled="true" disabled className="size-11"><SkipBack aria-hidden="true" /></Button>
                  <Button type="button" size="icon" aria-label="Pause playback" aria-disabled="true" disabled className="size-11"><Pause aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Next track" aria-disabled="true" disabled className="size-11"><SkipForward aria-hidden="true" /></Button>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2"><ListMusic aria-hidden="true" className="size-5 text-primary" /><h2 className="text-lg font-semibold">Queue</h2></div>
            <ol className="mt-4 divide-y divide-border">
              {QUEUE_ITEMS.map((track, index) => (
                <li key={track.title} className="flex min-h-14 items-center gap-3 py-3">
                  <span className="w-5 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{track.title}</p><p className="truncate text-xs text-muted-foreground">{track.artist}</p></div>
                  <span className="text-xs text-muted-foreground">3:20</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}