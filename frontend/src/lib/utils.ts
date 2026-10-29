import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0] ?? '?'];
  return letters.map((p) => Array.from(p)[0]?.toUpperCase() ?? '').join('') || '?';
}

export function hasLoginHintCookie(): boolean {
  return typeof document !== 'undefined' && document.cookie.split(';').some((cookie) => cookie.trim() === 'dbx_li=1');
}

export function setLoggedOutHintCookie(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `dbx_li=0; Max-Age=2592000; Path=/; SameSite=Lax${secure}`;
}
