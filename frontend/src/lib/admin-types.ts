export interface AdminHealthCheck {
  ok: boolean;
  detail: string;
}

export interface AdminOverview {
  health: {
    api: AdminHealthCheck;
    redis: AdminHealthCheck;
    postgres: AdminHealthCheck;
    bot: AdminHealthCheck;
    worker: AdminHealthCheck;
  };
  totals: {
    servers: number;
    usersEver: number;
    usersToday: number;
    messages24h: number;
    failed24h: number;
  };
  shards: Array<{
    id: string;
    status: string;
    pingMs: number;
    guilds: number;
    reconnects: number;
    at: string;
  }>;
  series: {
    days: 30;
    servers: Array<{ date: string; total: number; joins: number; leaves: number }>;
    messages: Array<{ date: string; sent: number; failed: number }>;
  };
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    oldestWaitingSeconds: number;
  };
}

export interface AdminRateLimits {
  perMinute: Array<{
    minute: number;
    total: number;
    c401: number;
    c403: number;
    c404: number;
    c429: number;
  }>;
  invalidLast10Min: number;
  recent429: Array<{
    route: string;
    scope: string | null;
    retryAfter: number;
    global: boolean;
    at: string;
  }>;
  blockedUntil: number | null;
  cache: Record<'settings' | 'channels' | 'userGuilds', number>;
  queue: AdminOverview['queue'];
}

export interface AdminGuildRow {
  id: string;
  name: string;
  memberCount: number;
  ownerId: string | null;
  joinedAt: string;
  lastMessageAt: string | null;
  welcomeEnabled: boolean;
  goodbyeEnabled: boolean;
}

export interface AdminGuildList {
  guilds: AdminGuildRow[];
  page: number;
  total: number;
  pages: number;
}

export interface AdminGuildDetail {
  guild: Pick<AdminGuildRow, 'id' | 'name' | 'memberCount' | 'ownerId' | 'joinedAt' | 'lastMessageAt'>;
  channels: Array<{
    kind: 'welcome' | 'goodbye';
    enabled: boolean;
    channelId: string | null;
    channelName: string | null;
    canBotPost: boolean | null;
  }>;
  recentErrors: Array<{ guildId?: string; kind?: string; reason?: string; at?: string }>;
}

export interface AdminMessageChannels {
  channels: Array<{ id: string; name: string; isDefault: boolean }>;
  defaultChannelId: string | null;
}

export interface AdminMessageInput {
  channelId?: string;
  content: string;
  embed?: { title?: string; description?: string; color?: string | number };
}

export interface AdminFailure {
  id: string;
  kind: string;
  guildId: string;
  reason: 'missing permission' | 'deleted channel' | 'render error' | 'other';
  time: string;
}

export interface AdminUsers {
  recentLogins: Array<{ id: string; username: string; avatar: string }>;
  activeSessions: number;
}

export interface AdminContent {
  presetUsage: Array<{ id: string; name: string; uses: number }>;
  backgrounds: Array<{ path: string; guildId: string; size: number; uploadedAt: string | null }>;
}

export interface AdminFlags {
  maintenance: boolean;
  musicEnabled: boolean;
  socialEnabled: boolean;
  messageRatePerMinute: number;
}

export interface AdminAuditPage {
  items: Array<{
    id: number;
    adminId: string;
    action: string;
    target: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}
