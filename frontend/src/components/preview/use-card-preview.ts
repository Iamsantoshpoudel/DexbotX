'use client';

import { useEffect, useRef, useState } from 'react';
import { getCard, getCardEtag, putCard, releaseCard, retainCard } from '@/lib/card-cache';
import type { ImageConfig, MessageKind } from '@/lib/types';
import { loginUrl } from '@/lib/utils';

interface PreviewState {
  url: string | null;
  cacheKey: string | null;
  loading: boolean;
  error: string | null;
}

const RENDER_VERSION = '1';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function imageKey(image: ImageConfig, avatarHash: string | null, bannerHash: string | null): Promise<string> {
  const input = `${RENDER_VERSION}${stableStringify(image)}${avatarHash ?? ''}${bannerHash ?? ''}${image.backgroundPath ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function useCardPreview(
  guildId: string,
  kind: MessageKind,
  image: ImageConfig | null,
  serverImageKey: string | null,
  avatarHash: string | null,
  bannerHash: string | null,
): { url: string | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<PreviewState>({ url: null, cacheKey: null, loading: false, error: null });
  const serverImageKeyRef = useRef(serverImageKey);
  serverImageKeyRef.current = serverImageKey;
  const signature = image ? stableStringify(image) : '';

  useEffect(() => {
    if (state.cacheKey) retainCard(state.cacheKey);
    return () => {
      if (state.cacheKey) releaseCard(state.cacheKey);
    };
  }, [state.cacheKey]);

  useEffect(() => {
    if (!image?.enabled) {
      setState({ url: null, cacheKey: null, loading: false, error: null });
      return;
    }

    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const computedKey = await imageKey(image, avatarHash, bannerHash);
        if (!active) return;
        const serverKey = serverImageKeyRef.current;
        const resolvedKey = serverKey && computedKey === serverKey ? serverKey : computedKey;
        const cacheKey = `${guildId}:${kind}:${resolvedKey}`;
        const cached = await getCard(cacheKey);
        if (!active) return;
        if (cached) {
          setState({ url: cached.url, cacheKey, loading: false, error: null });
          return;
        }

        setState((current) => ({ ...current, loading: true, error: null }));
        timer = setTimeout(async () => {
          try {
            const body = JSON.stringify({
              enabled: false,
              channelId: null,
              content: '',
              embed: { enabled: false, title: '', description: '', color: '#8ab4f8', footer: '' },
              image,
            });
            const url = `/api/guilds/${guildId}/messages/${kind}/preview`;
            const headers = new Headers({ 'Content-Type': 'application/json' });
            const etag = getCardEtag(cacheKey);
            if (etag) headers.set('If-None-Match', etag);
            let res = await fetch(url, {
              method: 'POST',
              headers,
              credentials: 'same-origin',
              body,
              signal: controller.signal,
            });
            if (res.status === 401) {
              window.location.assign(loginUrl(window.location.pathname));
              return;
            }
            if (res.status === 304) {
              const existing = await getCard(cacheKey);
              if (existing) {
                if (active) setState({ url: existing.url, cacheKey, loading: false, error: null });
                return;
              }
              res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body,
                signal: controller.signal,
              });
            }
            if (res.status === 401) {
              window.location.assign(loginUrl(window.location.pathname));
              return;
            }
            if (!res.ok) throw new Error(res.status === 429 ? 'Preview paused: too many updates. Wait a moment.' : 'Preview unavailable right now.');

            const blob = await res.blob();
            const responseKey = res.headers.get('X-Card-Key') ?? resolvedKey;
            const responseCacheKey = `${guildId}:${kind}:${responseKey}`;
            const card = await putCard(responseCacheKey, blob);
            if (active) setState({ url: card.url, cacheKey: responseCacheKey, loading: false, error: null });
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            if (active) setState((current) => ({ ...current, loading: false, error: (err as Error).message }));
          }
        }, 600);
      } catch (err) {
        if (active) setState((current) => ({ ...current, loading: false, error: (err as Error).message }));
      }
    };

    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [guildId, kind, signature, avatarHash, bannerHash]);

  return { url: state.url, loading: state.loading, error: state.error };
}
