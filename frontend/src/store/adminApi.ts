import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AdminFailure,
  AdminGuildDetail,
  AdminGuildList,
  AdminOverview,
  AdminRateLimits,
  AdminAuditPage,
  AdminContent,
  AdminFlags,
  AdminUsers,
} from '@/lib/admin-types';

export const adminApi = createApi({
  reducerPath: 'adminApi',
  tagTypes: ['AdminGuilds', 'AdminGuild', 'AdminFailures', 'AdminUsers', 'AdminContent', 'AdminFlags', 'AdminAudit'],
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' }),
  endpoints: (build) => ({
    getAdminMe: build.query<{ admin: true }, void>({
      query: () => '/admin/me',
      keepUnusedDataFor: 0,
    }),
    getOverview: build.query<AdminOverview, void>({
      query: () => '/admin/overview',
      keepUnusedDataFor: 30,
    }),
    getRateLimits: build.query<AdminRateLimits, void>({
      query: () => '/admin/rate-limits',
      keepUnusedDataFor: 10,
    }),
    getGuilds: build.query<AdminGuildList, { search: string; page: number }>({
      query: ({ search, page }) => `/admin/guilds?${new URLSearchParams({ search, page: String(page) })}`,
      providesTags: ['AdminGuilds'],
    }),
    getGuild: build.query<AdminGuildDetail, string>({
      query: (id) => `/admin/guilds/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'AdminGuild', id }],
    }),
    resyncGuild: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/admin/guilds/${encodeURIComponent(id)}/resync`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => ['AdminGuilds', { type: 'AdminGuild', id }],
    }),
    disableGuild: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/admin/guilds/${encodeURIComponent(id)}/disable`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => ['AdminGuilds', { type: 'AdminGuild', id }],
    }),
    leaveGuild: build.mutation<{ ok: true }, { id: string; confirm: string }>({
      query: ({ id, confirm }) => ({ url: `/admin/guilds/${encodeURIComponent(id)}/leave`, method: 'POST', body: { confirm } }),
      invalidatesTags: ['AdminGuilds', 'AdminGuild'],
    }),
    getFailures: build.query<AdminFailure[], void>({
      query: () => '/admin/failures',
      providesTags: ['AdminFailures'],
    }),
    retryFailure: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/admin/failures/${encodeURIComponent(id)}/retry`, method: 'POST' }),
      invalidatesTags: ['AdminFailures'],
    }),
    clearFailures: build.mutation<{ cleared: number }, { confirm: boolean }>({
      query: (body) => ({ url: '/admin/failures/clear', method: 'POST', body }),
      invalidatesTags: ['AdminFailures'],
    }),
    getAdminUsers: build.query<AdminUsers, void>({
      query: () => '/admin/users',
      providesTags: ['AdminUsers'],
    }),
    revokeUserSessions: build.mutation<{ revoked: number }, string>({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/revoke`, method: 'POST' }),
      invalidatesTags: ['AdminUsers'],
    }),
    getAdminContent: build.query<AdminContent, void>({
      query: () => '/admin/content',
      providesTags: ['AdminContent'],
    }),
    deleteAdminBackground: build.mutation<{ ok: true }, { path: string; confirm: boolean }>({
      query: (body) => ({ url: '/admin/content/background', method: 'POST', body }),
      invalidatesTags: ['AdminContent'],
    }),
    getAdminFlags: build.query<AdminFlags, void>({
      query: () => '/admin/flags',
      providesTags: ['AdminFlags'],
    }),
    updateAdminFlags: build.mutation<AdminFlags, AdminFlags>({
      query: (body) => ({ url: '/admin/flags', method: 'PUT', body }),
      invalidatesTags: ['AdminFlags'],
    }),
    getAdminAudit: build.query<AdminAuditPage, { page: number; action: string }>({
      query: ({ page, action }) => `/admin/audit?${new URLSearchParams({ page: String(page), action })}`,
      providesTags: ['AdminAudit'],
    }),
  }),
});

export const {
  useGetAdminMeQuery,
  useGetOverviewQuery,
  useGetRateLimitsQuery,
  useGetGuildsQuery,
  useGetGuildQuery,
  useResyncGuildMutation,
  useDisableGuildMutation,
  useLeaveGuildMutation,
  useGetFailuresQuery,
  useRetryFailureMutation,
  useClearFailuresMutation,
  useGetAdminUsersQuery,
  useRevokeUserSessionsMutation,
  useGetAdminContentQuery,
  useDeleteAdminBackgroundMutation,
  useGetAdminFlagsQuery,
  useUpdateAdminFlagsMutation,
  useGetAdminAuditQuery,
} = adminApi;
