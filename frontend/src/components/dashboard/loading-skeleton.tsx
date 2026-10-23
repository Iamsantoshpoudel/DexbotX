import { Skeleton } from '@/components/ui/misc';

export function GuildListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading servers" role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36" />)}
    </div>
  );
}

export function EditorSkeleton({ title = 'Welcome message', description = 'Sent when someone joins your server.' }: { title?: string; description?: string }) {
  return (
    <section aria-busy="true" aria-label="Loading configuration" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Skeleton className="h-9 w-24" />
      </header>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </section>
  );
}

export function OverviewSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading overview" className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your server modules at a glance.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36" />)}
      </div>
    </section>
  );
}