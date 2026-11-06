import Link from 'next/link';

type NavigationLink = Readonly<{ href: string; label: string }>;

export function PublicMobileNav({ links }: { links: readonly NavigationLink[] }) {
  return (
    <nav aria-label="Main" className="col-span-2 row-start-2 flex min-h-10 items-center justify-between gap-2 whitespace-nowrap text-xs lg:hidden">
      {links.map(({ href, label }) => (
        <Link key={href} className="rounded-sm text-white/70 underline-offset-4 hover:text-white hover:underline" href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
