import Link from 'next/link';
import Image from 'next/image';
import { SITE } from '@/lib/site';

export function LogoMark({ className = 'size-10' }: { className?: string }) {
  return <Image src="/icon.png" alt={`${SITE.brandName} logo`} width={60} height={60} className={`${className} rounded-full object-contain`} loading="eager" />;
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
      <LogoMark className="size-12 shrink-0" />
      <span className="text-lg">
        Dex<span className="text-primary">Bot</span>X
      </span>
    </Link>
  );
}
