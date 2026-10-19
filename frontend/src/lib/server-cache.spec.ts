import { afterEach, describe, expect, it, vi } from 'vitest';
import { readChannelsCache, readGuildsCache, writeChannelsCache, writeGuildsCache } from './server-cache';

const entries = new Map<string, string>();
const storage = {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => void entries.set(key, value),
  removeItem: (key: string) => void entries.delete(key),
};

afterEach(() => {
  entries.clear();
  vi.unstubAllGlobals();
});

describe('server metadata cache', () => {
  it('keeps guild lists separated by signed-in Discord user', () => {
    vi.stubGlobal('localStorage', storage);
    const guilds = [{ id: 'guild', name: 'Server', iconUrl: null, owner: true, botInstalled: true, inviteUrl: null }];
    writeGuildsCache('user-one', guilds);

    expect(readGuildsCache('user-one')).toEqual(guilds);
    expect(readGuildsCache('user-two')).toBeNull();
  });

  it('keeps channel lists separated by user and guild', () => {
    vi.stubGlobal('localStorage', storage);
    const channels = [{ id: 'channel', name: 'general', category: null }];
    writeChannelsCache('user-one', 'guild-one', channels);

    expect(readChannelsCache('user-one', 'guild-one')).toEqual(channels);
    expect(readChannelsCache('user-two', 'guild-one')).toBeNull();
    expect(readChannelsCache('user-one', 'guild-two')).toBeNull();
  });

  it('ignores malformed cache contents', () => {
    vi.stubGlobal('localStorage', storage);
    entries.set('dexbotx:v1:guilds:user-one', JSON.stringify({ version: 1, savedAt: Date.now(), data: [{ id: 3 }] }));

    expect(readGuildsCache('user-one')).toBeNull();
    expect(entries.has('dexbotx:v1:guilds:user-one')).toBe(false);
  });
});
