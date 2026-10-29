import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { toast } from 'sonner';
import { parseRetryAfter, rateLimitMessage } from '@/lib/rate-limit';
import { setLoggedOutHintCookie } from '@/lib/utils';
import type {
  Channel,
  GuildDetail,
  GuildRefreshResult,
  GuildRole,
  GuildSettings,
  GuildSummary,
  Me,
  MessageConfig,
  MessageKind,
  Preset,
  SavedMessage,
} from '@/lib/types';

const rawBaseQuery = fetchBaseQuery({
  // Same-origin: Next.js proxies /api/* to the backend, so the httpOnly session cookie rides along automatically.
  baseUrl: '/api',
  credentials: 'same-origin',
});

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, baseQueryApi, extra) => {
  const result = await rawBaseQuery(args, baseQueryApi, extra);
  const requestUrl = typeof args === 'string' ? args : args.url;
  if (
    result.error?.status === 401 &&
    !requestUrl.startsWith('/auth/') &&
    typeof window !== 'undefined'
  ) {
    setLoggedOutHintCookie();
    baseQueryApi.dispatch(api.util.invalidateTags(['Auth']));
  }
  // Rate limited: tell the user how long to wait. A fixed toast id collapses repeats into one message. No auto-retry.
  if (result.error?.status === 429 && typeof window !== 'undefined') {
    toast.error(rateLimitMessage(parseRetryAfter(result.meta?.response?.headers.get('retry-after'))), { id: 'rate-limit' });
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Auth', 'Guilds', 'Guild', 'Channels', 'Roles'],
  refetchOnFocus: false,
  refetchOnReconnect: false,
  refetchOnMountOrArgChange: false,
  endpoints: (b) => ({
    getMe: b.query<Me, void>({
      query: () => '/auth/me',
      keepUnusedDataFor: 0,
      providesTags: ['Auth'],
    }),
    logout: b.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST', credentials: 'include' }),
    }),

    getGuilds: b.query<GuildSummary[], void>({
      query: () => '/guilds',
      transformResponse: (r: { guilds: GuildSummary[] }) => r.guilds,
      providesTags: ['Guilds'],
    }),
    getGuild: b.query<{
      guild: GuildDetail;
      settings: GuildSettings;
      imageKeys: Record<MessageKind, string | null>;
      assetHashes: { avatar: string | null; banner: string | null };
    }, string>({
      query: (guildId) => `/guilds/${guildId}`,
      keepUnusedDataFor: 600,
      providesTags: (_r, _e, guildId) => [{ type: 'Guild', id: guildId }],
    }),
    getChannels: b.query<Channel[], string>({
      query: (guildId) => `/guilds/${guildId}/channels`,
      transformResponse: (r: { channels: Channel[] }) => r.channels,
      keepUnusedDataFor: 60,
      providesTags: (_r, _e, guildId) => [{ type: 'Channels', id: guildId }],
    }),
    getRoles: b.query<GuildRole[], string>({
      query: (guildId) => `/guilds/${guildId}/roles`,
      transformResponse: (r: { roles: GuildRole[] }) => r.roles,
      keepUnusedDataFor: 60,
      providesTags: (_r, _e, guildId) => [{ type: 'Roles', id: guildId }],
    }),
    refreshGuild: b.mutation<GuildRefreshResult, string>({
      query: (guildId) => ({ url: `/guilds/${guildId}/refresh`, method: 'POST' }),
      invalidatesTags: (_r, _e, guildId) => [
        { type: 'Guild', id: guildId },
        { type: 'Channels', id: guildId },
        { type: 'Roles', id: guildId },
      ],
    }),
    getPresets: b.query<Preset[], void>({
      query: () => '/presets',
      transformResponse: (r: { presets: Preset[] }) => r.presets,
      keepUnusedDataFor: 86400,
    }),

    saveMessage: b.mutation<SavedMessage, { guildId: string; kind: MessageKind; config: MessageConfig }>({
      query: ({ guildId, kind, config }) => ({ url: `/guilds/${guildId}/messages/${kind}`, method: 'PUT', body: config }),
      async onQueryStarted({ guildId, kind }, { dispatch, queryFulfilled }) {
        try {
          const { data: saved } = await queryFulfilled;
          dispatch(api.util.updateQueryData('getGuild', guildId, (current) => {
            current.settings[kind] = saved.config;
            current.imageKeys[kind] = saved.imageKey;
          }));
        } catch {
          // The mutation result reports save failures to its caller.
        }
      },
    }),
    resetMessage: b.mutation<SavedMessage, { guildId: string; kind: MessageKind }>({
      query: ({ guildId, kind }) => ({ url: `/guilds/${guildId}/messages/${kind}`, method: 'DELETE' }),
      async onQueryStarted({ guildId, kind }, { dispatch, queryFulfilled }) {
        try {
          const { data: saved } = await queryFulfilled;
          dispatch(api.util.updateQueryData('getGuild', guildId, (current) => {
            current.settings[kind] = saved.config;
            current.imageKeys[kind] = saved.imageKey;
          }));
        } catch {
          // The mutation result reports reset failures to its caller.
        }
      },
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
  useGetRolesQuery,
  useRefreshGuildMutation,
  useGetPresetsQuery,
  useSaveMessageMutation,
  useResetMessageMutation,
  useSendTestMutation,
  useUploadBackgroundMutation,
} = api;
