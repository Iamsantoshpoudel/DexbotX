import { describe, expect, it } from 'vitest';
import { isSocialPreviewUserAgent } from './social-preview-user-agent';

describe('isSocialPreviewUserAgent', () => {
  it('matches the configured social preview crawlers without case sensitivity', () => {
    expect(isSocialPreviewUserAgent('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isSocialPreviewUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isSocialPreviewUserAgent('MASTODON')).toBe(true);
  });

  it('does not match Discord or an ordinary browser user agent', () => {
    expect(isSocialPreviewUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe(false);
    expect(isSocialPreviewUserAgent('curl/8.0')).toBe(false);
    expect(isSocialPreviewUserAgent(null)).toBe(false);
  });
});
