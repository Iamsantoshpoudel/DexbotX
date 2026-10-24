import { Card, Skeleton } from '@/components/ui/misc';

export default function AdminLoading() {
  return (
    <div aria-label="Loading admin overview" className="space-y-6">
      <div>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index} className="h-32 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-5 h-8 w-28" />
          </Card>
        ))}
      </div>
      <Card className="h-[330px] p-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-5 h-[250px] w-full" />
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-[330px] p-5"><Skeleton className="h-full w-full" /></Card>
        <Card className="h-[330px] p-5"><Skeleton className="h-full w-full" /></Card>
      </div>
    </div>
  );
}
