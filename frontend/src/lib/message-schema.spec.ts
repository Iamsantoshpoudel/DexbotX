import { describe, expect, it } from 'vitest';
import { FIELD_IDS, validateMessage } from './message-schema';
import type { MessageConfig } from './types';

const CHANNEL = '123456789012345678';
const PATH = `${'1'.repeat(18)}/${'b'.repeat(64)}.jpg`;

const valid: MessageConfig = {
  enabled: true,
  channelId: CHANNEL,
  content: 'Welcome {user}!',
  embed: { enabled: false, title: '', description: '', color: '#8ab4f8', footer: '' },
  image: { enabled: true, style: 'midnight', title: 'Welcome', subtitle: 'Hi', accentColor: '#8ab4f8', useServerBanner: false, avatarShape: 'circle', showMemberCount: true, backgroundPath: null },
};
const withImage = (image: Partial<MessageConfig['image']>): MessageConfig => ({ ...valid, image: { ...valid.image, ...image } });
const withEmbed = (embed: Partial<MessageConfig['embed']>): MessageConfig => ({ ...valid, embed: { ...valid.embed, ...embed } });

describe('validateMessage', () => {
  it('accepts a valid config, with and without a background', () => {
    expect(validateMessage(valid)).toEqual({});
    expect(validateMessage(withImage({ backgroundPath: PATH }))).toEqual({});
  });

  it('allows a disabled message with no channel (a fresh server)', () => {
    expect(validateMessage({ ...valid, enabled: false, channelId: null })).toEqual({});
  });

  it('requires a channel when enabled', () => {
    expect(validateMessage({ ...valid, channelId: null }).channelId).toMatch(/channel/i);
  });

  it('rejects an enabled message that would be empty', () => {
    const empty = { ...valid, content: '  ', image: { ...valid.image, enabled: false } };
    expect(validateMessage(empty).content).toMatch(/at least one/i);
    expect(validateMessage({ ...empty, image: { ...empty.image, enabled: true } })).toEqual({});
  });

  it('requires a title or description when the embed is on', () => {
    expect(validateMessage(withEmbed({ enabled: true }))['embed.title']).toMatch(/title or a description/i);
    expect(validateMessage(withEmbed({ enabled: true, description: 'x' }))).toEqual({});
  });

  it('checks colours, lengths and the background reference with dotted field paths', () => {
    expect(validateMessage(withImage({ accentColor: 'red' }))['image.accentColor']).toBeDefined();
    expect(validateMessage(withEmbed({ color: '#12345' }))['embed.color']).toBeDefined();
    expect(validateMessage(withImage({ title: 'x'.repeat(41) }))['image.title']).toMatch(/40/);
    expect(validateMessage(withImage({ subtitle: 'x'.repeat(101) }))['image.subtitle']).toMatch(/100/);
    expect(validateMessage({ ...valid, content: 'x'.repeat(2001) }).content).toMatch(/2000/);
    expect(validateMessage(withImage({ backgroundPath: '../../etc/passwd' }))['image.backgroundPath']).toBeDefined();
    expect(validateMessage({ ...valid, channelId: 'not-an-id' }).channelId).toBeDefined();
  });

  it('rejects unknown keys like the server does', () => {
    const extra = { ...valid, surprise: true } as unknown as MessageConfig;
    expect(Object.keys(validateMessage(extra)).length).toBeGreaterThan(0);
  });

  it('maps every field the editor shows to an element id', () => {
    for (const path of ['channelId', 'content', 'image.title', 'image.subtitle', 'image.accentColor', 'embed.title', 'embed.description', 'embed.color', 'embed.footer']) {
      expect(FIELD_IDS[path]).toBeTruthy();
    }
  });
});
