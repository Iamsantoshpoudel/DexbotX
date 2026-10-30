import Link from 'next/link';
import { BreadcrumbStructuredData } from '@/components/seo/json-ld';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BreadcrumbItem = { name: string; path: string };

export function PublicBreadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <>
      <BreadcrumbStructuredData items={items} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap gap-2">
          {items.map(({ name, path }, index) => {
            const isCurrent = index === items.length - 1;
            return (
              <li key={path} className="flex gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                {isCurrent ? (
                  <span aria-current="page">{name}</span>
                ) : (
                  <Link className="underline-offset-4 hover:underline" href={path}>{name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

export function AddToDiscordButton() {
  return (
    <a href="/api/invite" className={cn(buttonVariants({ size: 'lg' }))}>
      Add DexBotX to Discord
    </a>
  );
}
