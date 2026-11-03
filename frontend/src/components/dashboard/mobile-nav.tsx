'use client';

import { ArrowLeft, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GuildDetail } from '@/lib/types';
import { Sidebar } from './sidebar';

export function MobileNav({ guild, guildId, lastSyncedLabel }: { guild?: GuildDetail; guildId: string; lastSyncedLabel?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <Button ref={triggerRef} type="button" variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Open server navigation" aria-expanded={open} aria-controls="mobile-server-navigation" onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" />
      </Button>
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <button type="button" tabIndex={open ? 0 : -1} aria-label="Close server navigation" className={`absolute inset-0 bg-black/50 transition-opacity motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <div
          id="mobile-server-navigation"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Server navigation"
          inert={!open}
          className={`absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2.5rem))] flex-col overflow-hidden border-r border-border bg-surface shadow-xl transition-transform motion-reduce:transition-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="text-sm font-semibold">Server navigation</span>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Close server navigation" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Sidebar guild={guild} guildId={guildId} pathname={pathname} lastSyncedLabel={lastSyncedLabel} onNavigate={() => setOpen(false)} />
          </div>
          <div className="shrink-0 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-primary/50 bg-primary/15 px-4 text-sm font-semibold text-primary shadow-[0_0_20px_rgba(138,180,248,0.25)] transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden="true" />
              Back to site
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}