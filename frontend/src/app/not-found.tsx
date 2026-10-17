import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">This page wandered off</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be wrong, or the page no longer exists.</p>
        <Link href="/" className={buttonVariants({ className: 'mt-6' })}>
          Back home
        </Link>
      </div>
    </main>
  );
}
