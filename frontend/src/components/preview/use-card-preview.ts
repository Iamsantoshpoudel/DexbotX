'use client';

import { useEffect, useRef, useState } from 'react';
import type { ImageConfig, MessageKind } from '@/lib/types';
import { loginUrl } from '@/lib/utils';

interface PreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the REAL card, rendered by the same server code the bot uses, so what you see is exactly what members get.
 * Debounced, cancels stale requests, and revokes old blob URLs. Only the image settings affect the card.
 */
export function useCardPreview(guildId: string, kind: MessageKind, image: ImageConfig | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ url: null, loading: false, error: null });
  const imageRef = useRef(image);
  imageRef.current = image;
  const urlRef = useRef<string | null>(null);
  const enabled = !!image?.enabled;
  const signature = image ? JSON.stringify(image) : '';

  useEffect(() => {
    const current = imageRef.current;
    if (!enabled || !current) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));

    const timer = setTimeout(async () => {
      try {
        // A minimal valid message: the endpoint only needs the image settings to draw the card.
        const body = JSON.stringify({
          enabled: false,
          channelId: null,
          content: '',
          embed: { enabled: false, title: '', description: '', color: '#5b4bff', footer: '' },
          image: current,
        });
        const res = await fetch(`/api/guilds/${guildId}/messages/${kind}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body,
          signal: controller.signal,
        });
        if (res.status === 401) {
          window.location.assign(loginUrl(window.location.pathname));
          return;
        }
        if (!res.ok) throw new Error(res.status === 429 ? 'Preview paused: too many updates. Wait a moment.' : 'Preview unavailable right now.');
        const next = URL.createObjectURL(await res.blob());
        const prev = urlRef.current;
        urlRef.current = next;
        setState({ url: next, loading: false, error: null });
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1500);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [guildId, kind, enabled, signature]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return state;
}
