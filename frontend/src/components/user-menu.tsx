'use client';

import { LogOut } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useLogoutMutation } from '@/store/api';
import type { Me } from '@/lib/types';

export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [logout, { isLoading }] = useLogoutMutation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onLogout() {
    await logout().unwrap().catch(() => undefined);
    // Hard navigation drops every cached query so the next visitor on this browser sees nothing.
    window.location.assign(new URL('/', window.location.origin));
  }

  const name = me.globalName ?? me.username;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex min-h-11 min-w-11 items-center gap-2 rounded-lg border border-border bg-card/60 py-1 pl-1 pr-1 text-sm hover:bg-muted sm:pr-3"
      >
        <Image src={me.avatarUrl} alt="" width={28} height={28} sizes="28px" className="size-7 rounded-full" referrerPolicy="no-referrer" />
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Signed in as
            <div className="truncate text-sm text-foreground">@{me.username}</div>
          </div>
          <button
            role="menuitem"
            onClick={onLogout}
            disabled={isLoading}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
