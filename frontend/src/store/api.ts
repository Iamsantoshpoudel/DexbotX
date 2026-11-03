import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { TypedUseQuerySubscriptionOptions } from '@reduxjs/toolkit/query/react';
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
  keepUnusedDataFor: 3600,
  endpoints: (b) => ({
    getMe: b.query<Me, void>({
      query: () => '/auth/me',
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

const getMeQuery = api.endpoints.getMe.useQuery;
const getGuildsQuery = api.endpoints.getGuilds.useQuery;
const getGuildQuery = api.endpoints.getGuild.useQuery;
const getChannelsQuery = api.endpoints.getChannels.useQuery;
const getPresetsQuery = api.endpoints.getPresets.useQuery;

type QueryOptions = Omit<TypedUseQuerySubscriptionOptions, 'refetchOnMountOrArgChange'>;

// RTK Query applies mount freshness at the hook level, so keep endpoint policies centralized here.
export function useGetMeQuery(arg?: void, options?: QueryOptions) {
  return getMeQuery(arg, { ...options, refetchOnMountOrArgChange: 300 });
}

export function useGetGuildsQuery(arg?: void, options?: QueryOptions) {
  return getGuildsQuery(arg, { ...options, refetchOnMountOrArgChange: false });
}

export function useGetGuildQuery(guildId: string, options?: QueryOptions) {
  return getGuildQuery(guildId, { ...options, refetchOnMountOrArgChange: 60 });
}

export function useGetChannelsQuery(guildId: string, options?: QueryOptions) {
  return getChannelsQuery(guildId, { ...options, refetchOnMountOrArgChange: false });
}

export function useGetPresetsQuery(arg?: void, options?: QueryOptions) {
  return getPresetsQuery(arg, { ...options, refetchOnMountOrArgChange: 86400 });
}

export const {
  useLogoutMutation,
  useGetRolesQuery,
  useRefreshGuildMutation,
  useSaveMessageMutation,
  useResetMessageMutation,
  useSendTestMutation,
  useUploadBackgroundMutation,
} = api;
