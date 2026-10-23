/** Mirrors the backend's API contract (backend/src/shared/message-config.ts and the controllers). */
export type MessageKind = 'welcome' | 'goodbye';
export const MESSAGE_KINDS: readonly MessageKind[] = ['welcome', 'goodbye'];

export type ImageStyleId = 'midnight' | 'sunset' | 'aurora' | 'neon' | 'ocean' | 'minimal';

export interface EmbedConfig {
  enabled: boolean;
  title: string;
  description: string;
  color: string;
  footer: string;
}

export interface ImageConfig {
  enabled: boolean;
  style: ImageStyleId;
  title: string;
  subtitle: string;
  accentColor: string;
  useServerBanner: boolean;
  avatarShape: 'circle' | 'rounded';
  showMemberCount: boolean;
  /** Uploaded background in private storage ("<guildId>/<sha256>.jpg"). Overrides the server banner. */
  backgroundPath: string | null;
}

export interface MessageContent {
  content: string;
  embed: EmbedConfig;
  image: ImageConfig;
}

export interface MessageConfig extends MessageContent {
  enabled: boolean;
  channelId: string | null;
}

export interface Me {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
}

export interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botInstalled: boolean;
  inviteUrl: string | null;
}

export interface GuildDetail {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  lastSyncedAt: string | null;
}

export interface GuildSettings {
  welcome: MessageConfig;
  goodbye: MessageConfig;
}

export interface SavedMessage {
  config: MessageConfig;
  imageKey: string | null;
}

export interface Channel {
  id: string;
  name: string;
  category: string | null;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface GuildRefreshResult {
  guild: { id: string; name: string; icon: string | null; ownerId: string | null; memberCount: number };
  channels: Channel[];
  roles: GuildRole[];
  lastSyncedAt: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  kind: MessageKind;
  config: MessageContent;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  issues?: Array<{ path: string; message: string }>;
}
