'use client';

import { useEffect } from 'react';
import { errorStatus } from '@/lib/errors';
import { useAppDispatch } from '@/store/hooks';
import { api } from '@/store/api';

export function GuildLiveUpdates() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const events = new EventSource('/api/events/guilds');
    let connected = false;
    events.onopen = () => {
      if (connected) {
        dispatch(api.util.invalidateTags(['Guilds']));
        const currentGuild = window.location.pathname.match(/^\/dashboard\/([^/]+)\//)?.[1];
        if (currentGuild) {
          const guildId = decodeURIComponent(currentGuild);
          dispatch(api.util.invalidateTags([{ type: 'Guild', id: guildId }, { type: 'Channels', id: guildId }]));
        }
      }
      connected = true;
    };
    events.addEventListener('guilds_changed', (event) => {
      const { guildId } = JSON.parse((event as MessageEvent).data) as { guildId: string };
      dispatch(api.util.invalidateTags(['Guilds']));
      const currentGuild = window.location.pathname.match(/^\/dashboard\/([^/]+)\//)?.[1];
      if (guildId === '*' || currentGuild === encodeURIComponent(guildId)) {
        if (currentGuild) {
          const request = dispatch(
            api.endpoints.getGuild.initiate(decodeURIComponent(currentGuild), { forceRefetch: true, subscribe: false }),
          );
          void request.unwrap().catch((error: unknown) => {
            if (errorStatus(error) === 403 || errorStatus(error) === 404) window.location.assign('/dashboard');
          });
        }
      } else {
        dispatch(api.util.invalidateTags([{ type: 'Guild', id: guildId }]));
      }
    });
    events.addEventListener('channels_changed', (event) => {
      const { guildId } = JSON.parse((event as MessageEvent).data) as { guildId: string };
      dispatch(api.util.invalidateTags([{ type: 'Channels', id: guildId }]));
    });
    events.addEventListener('roles_changed', (event) => {
      const { guildId } = JSON.parse((event as MessageEvent).data) as { guildId: string };
      dispatch(api.util.invalidateTags([{ type: 'Roles', id: guildId }]));
    });
    events.addEventListener('guild_synced', (event) => {
      const { guildId } = JSON.parse((event as MessageEvent).data) as { guildId: string };
      dispatch(api.util.invalidateTags([
        { type: 'Guild', id: guildId },
        { type: 'Channels', id: guildId },
        { type: 'Roles', id: guildId },
      ]));
    });
    events.addEventListener('settings_changed', (event) => {
      const { guildId } = JSON.parse((event as MessageEvent).data) as { guildId: string };
      dispatch(api.util.invalidateTags([{ type: 'Guild', id: guildId }]));
    });
    return () => events.close();
  }, [dispatch]);

  return null;
}
