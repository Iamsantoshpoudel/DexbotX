import { describe, expect, it } from 'vitest';
import { isDiscordUserAgent } from './discord-user-agent';

describe('isDiscordUserAgent', () => {
  it('matches Discord crawlers without case sensitivity', () => {
    expect(isDiscordUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe(true);
    expect(isDiscordUserAgent('DISCORDBOT')).toBe(true);
  });

  it('does not match other social crawlers or an ordinary browser user agent', () => {
    expect(isDiscordUserAgent('TelegramBot (like TwitterBot)')).toBe(false);
    expect(isDiscordUserAgent('curl/8.0')).toBe(false);
    expect(isDiscordUserAgent(null)).toBe(false);
  });
});
