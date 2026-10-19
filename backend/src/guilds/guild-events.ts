export const GUILD_MEMBERSHIP_EVENTS_CHANNEL = 'dexbotx:guilds:membership';
export const GUILD_CHANNELS_CHANGED_CHANNEL = 'dexbotx:guilds:channels';
export const GUILD_SETTINGS_CHANGED_CHANNEL = 'dexbotx:guilds:settings';
export const GUILD_ROLES_CHANGED_CHANNEL = 'dexbotx:guilds:roles';
export const GUILD_SYNCED_CHANNEL = 'dexbotx:guilds:synced';

export function guildChannelsCacheKey(guildId: string): string {
  return `guild:${guildId}:channels`;
}

export function guildRolesCacheKey(guildId: string): string {
  return `guild:${guildId}:roles`;
}

export function guildMetaCacheKey(guildId: string): string {
  return `guild:${guildId}:meta`;
}

export function guildSettingsCacheKey(guildId: string): string {
  return `guild:${guildId}:settings`;
}
