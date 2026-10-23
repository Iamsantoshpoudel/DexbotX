import { Check, Circle, Info, Music2 } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function StatusPill({ on }: { on: boolean }) {
  return (
    <Badge tone={on ? 'success' : 'neutral'} className="gap-1.5 rounded-lg px-2.5 py-1">
      {on ? <Check aria-hidden="true" className="size-3" /> : <Circle aria-hidden="true" className="size-2.5" />}
      {on ? 'Enabled' : 'Disabled'}
    </Badge>
  );
}

export function ModuleCard({
  title,
  description,
  icon: Icon,
  status,
  href,
  actionLabel,
  muted = false,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>;
  status?: ReactNode;
  href?: string;
  actionLabel?: string;
  muted?: boolean;
}) {
  return (
    <Card className={cn('flex min-h-52 flex-col p-5', muted && 'border-dashed bg-transparent')}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        {status}
      </div>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {href && actionLabel && (
        <Link href={href} prefetch className={cn(buttonVariants({ variant: 'outline' }), 'mt-auto min-h-11 w-full')}>
          {actionLabel}
        </Link>
      )}
    </Card>
  );
}

export function PreviewBanner() {
  return (
    <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-accent-soft px-4 py-3 text-sm text-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p><span className="font-semibold">Preview:</span> this module is not available yet. You can look around, but nothing is saved.</p>
    </div>
  );
}

export function DiscordMessageMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="grid size-9 place-items-center rounded-full bg-accent-soft text-primary">
          <Music2 aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sample Creator</p>
          <p className="text-xs text-muted-foreground">social notification</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm">New post from Sample Creator</p>
        <div className="rounded-lg border-l-2 border-primary bg-card p-3">
          <p className="text-sm font-semibold">Sample post title</p>
          <p className="mt-1 text-sm text-muted-foreground">A preview of a notification embed will appear here.</p>
          <p className="mt-3 break-all text-xs text-primary">example.invalid/sample-post</p>
        </div>
      </div>
    </div>
  );
}

