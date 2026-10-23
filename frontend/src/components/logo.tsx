import Link from 'next/link';
import Image from 'next/image';

export function LogoMark({ className = 'size-10', preload = false }: { className?: string; preload?: boolean }) {
  return <Image src="/icon.png" alt="DexbotX Logo" width={60} height={60} className={`${className} rounded-full object-contain`} preload={preload} />;
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
      <LogoMark className="size-12 shrink-0" preload />
      <span className="text-lg">
        Dex<span className="text-primary">Bot</span>X
      </span>
    </Link>
  );
}
