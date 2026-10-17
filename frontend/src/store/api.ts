import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { toast } from 'sonner';
import { parseRetryAfter, rateLimitMessage } from '@/lib/rate-limit';
import { loginUrl } from '@/lib/utils';
import type {
  Channel,
  GuildDetail,
  GuildSettings,
  GuildSummary,
  Me,
  MessageConfig,
  MessageKind,
  Preset,
} from '@/lib/types';

const rawBaseQuery = fetchBaseQuery({
  // Same-origin: Next.js proxies /api/* to the backend, so the httpOnly session cookie rides along automatically.
  baseUrl: '/api',
  credentials: 'same-origin',
});

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);
  // Rate limited: tell the user how long to wait. A fixed toast id collapses repeats into one message. No auto-retry.
  if (result.error?.status === 429 && typeof window !== 'undefined') {
    toast.error(rateLimitMessage(parseRetryAfter(result.meta?.response?.headers.get('retry-after'))), { id: 'rate-limit' });
  }
  // Expired or missing session inside the dashboard: restart the login flow and come back to the same page.
  if (result.error?.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
    window.location.assign(loginUrl(window.location.pathname));
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Guilds', 'Guild'],
  refetchOnFocus: true,
  endpoints: (b) => ({
    getMe: b.query<Me, void>({ query: () => '/auth/me', keepUnusedDataFor: 300 }),
    logout: b.mutation<void, void>({ query: () => ({ url: '/auth/logout', method: 'POST' }) }),

    getGuilds: b.query<GuildSummary[], void>({
      query: () => '/guilds',
      transformResponse: (r: { guilds: GuildSummary[] }) => r.guilds,
      providesTags: ['Guilds'],
    }),
    getGuild: b.query<{ guild: GuildDetail; settings: GuildSettings }, string>({
      query: (guildId) => `/guilds/${guildId}`,
      providesTags: (_r, _e, guildId) => [{ type: 'Guild', id: guildId }],
    }),
    getChannels: b.query<Channel[], string>({
      query: (guildId) => `/guilds/${guildId}/channels`,
      transformResponse: (r: { channels: Channel[] }) => r.channels,
      keepUnusedDataFor: 60,
    }),
    getPresets: b.query<Preset[], void>({
      query: () => '/templates/presets',
      transformResponse: (r: { presets: Preset[] }) => r.presets,
      keepUnusedDataFor: 3600,
    }),

    saveMessage: b.mutation<MessageConfig, { guildId: string; kind: MessageKind; config: MessageConfig }>({
      query: ({ guildId, kind, config }) => ({ url: `/guilds/${guildId}/messages/${kind}`, method: 'PUT', body: config }),
      transformResponse: (r: { config: MessageConfig }) => r.config,
      invalidatesTags: (_r, _e, a) => [{ type: 'Guild', id: a.guildId }],
    }),
    /** multipart/form-data; fetchBaseQuery leaves the Content-Type to the browser so the boundary is set correctly. */
    uploadBackground: b.mutation<{ path: string }, { guildId: string; file: File }>({
      query: ({ guildId, file }) => {
        const body = new FormData();
        body.append('file', file);
        return { url: `/guilds/${guildId}/assets/background`, method: 'POST', body };
      },
    }),
    sendTest: b.mutation<{ channelId: string }, { guildId: string; kind: MessageKind }>({
      query: ({ guildId, kind }) => ({ url: `/guilds/${guildId}/messages/${kind}/test`, method: 'POST' }),
    }),
  }),
});

export const {
  useGetMeQuery,
  useLogoutMutation,
  useGetGuildsQuery,
  useGetGuildQuery,
  useGetChannelsQuery,
  useGetPresetsQuery,
  useSaveMessageMutation,
  useSendTestMutation,
  useUploadBackgroundMutation,
} = api;
