import type { Channel, GuildSummary } from './types';

const CACHE_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  version: number;
  savedAt: number;
  data: T;
}

function readCache<T>(key: string, isData: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const entry = parsed as Partial<CacheEntry<unknown>>;
    if (
      entry.version !== CACHE_VERSION ||
      typeof entry.savedAt !== 'number' ||
      Date.now() - entry.savedAt > MAX_AGE_MS ||
      !isData(entry.data)
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch (error) {
    console.warn('Could not read cached server metadata from local storage.', error);
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), data }));
  } catch (error) {
    console.warn('Could not save cached server metadata to local storage.', error);
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isGuildSummaries(value: unknown): value is GuildSummary[] {
  return (
    Array.isArray(value) &&
    value.every(
      (guild) =>
        typeof guild === 'object' &&
        guild !== null &&
        typeof guild.id === 'string' &&
        typeof guild.name === 'string' &&
        isNullableString(guild.iconUrl) &&
        typeof guild.owner === 'boolean' &&
        typeof guild.botInstalled === 'boolean' &&
        isNullableString(guild.inviteUrl),
    )
  );
}

function isChannels(value: unknown): value is Channel[] {
  return (
    Array.isArray(value) &&
    value.every(
      (channel) =>
        typeof channel === 'object' &&
        channel !== null &&
        typeof channel.id === 'string' &&
        typeof channel.name === 'string' &&
        isNullableString(channel.category),
    )
  );
}

export function readGuildsCache(userId: string): GuildSummary[] | null {
  return readCache(`dexbotx:v1:guilds:${userId}`, isGuildSummaries);
}

export function writeGuildsCache(userId: string, guilds: GuildSummary[]): void {
  writeCache(`dexbotx:v1:guilds:${userId}`, guilds);
}

export function readChannelsCache(userId: string, guildId: string): Channel[] | null {
  return readCache(`dexbotx:v1:channels:${userId}:${guildId}`, isChannels);
}

export function writeChannelsCache(userId: string, guildId: string, channels: Channel[]): void {
  writeCache(`dexbotx:v1:channels:${userId}:${guildId}`, channels);
}
