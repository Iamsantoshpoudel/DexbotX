import { randomBytes } from 'node:crypto';
import { decrypt, encrypt } from './crypto';
import { userAvatarUrl } from './discord-cdn';
import { defaultMessageConfig, messageConfigSchema } from './message-config';
import { canManageGuild } from './permissions';
import { applyPlaceholders, ordinal } from './placeholders';
import { PRESETS } from './presets';
import { Semaphore } from './semaphore';
import { safeReturnTo } from '../auth/auth.service';

const ctx = { userId: '123456789012345678', username: 'dex_user', displayName: '@everyone *bold*', serverName: 'My Server', memberCount: 1284 };

describe('placeholders', () => {
  it('formats ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111, 1284].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th', '1,284th',
    ]);
  });

  it('renders {user} as a mention in messages and a plain name in images', () => {
    expect(applyPlaceholders('Hi {user}', ctx, { target: 'message' })).toBe('Hi <@123456789012345678>');
    expect(applyPlaceholders('Hi {user}', ctx, { target: 'image' })).toBe('Hi @everyone *bold*');
  });

  it('escapes markdown and defuses @everyone in names used in messages', () => {
    const out = applyPlaceholders('{displayName}', ctx, { target: 'message' });
    expect(out).not.toContain('@everyone');
    expect(out).toContain('\\*bold\\*');
  });

  it('formats member counts and leaves unknown placeholders alone', () => {
    expect(applyPlaceholders('#{memberCount} {memberCountOrdinal} {nope}', ctx, { target: 'image' })).toBe('#1,284 1,284th {nope}');
  });
});

describe('message config schema', () => {
  it('accepts both defaults', () => {
    expect(messageConfigSchema.safeParse(defaultMessageConfig('welcome')).success).toBe(true);
    expect(messageConfigSchema.safeParse(defaultMessageConfig('goodbye')).success).toBe(true);
  });

  it('accepts every preset once a channel is set', () => {
    for (const p of PRESETS) {
      const res = messageConfigSchema.safeParse({ enabled: true, channelId: '123456789012345678', ...p.config });
      expect({ id: p.id, ok: res.success }).toEqual({ id: p.id, ok: true });
    }
  });

  it('rejects unknown keys, bad colors and empty enabled messages', () => {
    const base = defaultMessageConfig('welcome');
    expect(messageConfigSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(messageConfigSchema.safeParse({ ...base, image: { ...base.image, accentColor: 'red' } }).success).toBe(false);
    expect(
      messageConfigSchema.safeParse({ ...base, enabled: true, content: '  ', embed: { ...base.embed, enabled: false }, image: { ...base.image, enabled: false } }).success,
    ).toBe(false);
    expect(messageConfigSchema.safeParse({ ...base, channelId: 'not-an-id' }).success).toBe(false);
    expect(messageConfigSchema.safeParse({ ...base, content: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('crypto', () => {
  const key = randomBytes(32);
  it('round-trips and rejects tampering', () => {
    const enc = encrypt('discord-access-token', key);
    expect(enc).not.toContain('discord-access-token');
    expect(decrypt(enc, key)).toBe('discord-access-token');
    const parts = enc.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
    parts[3] = enc.split('.')[3];
    parts[2] = Buffer.from('short').toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow('Invalid ciphertext');
    expect(() => decrypt(enc, randomBytes(32))).toThrow();
  });
});

describe('permissions', () => {
  it('allows owner, Administrator and Manage Server only', () => {
    expect(canManageGuild({ owner: true, permissions: '0' })).toBe(true);
    expect(canManageGuild({ owner: false, permissions: '8' })).toBe(true);
    expect(canManageGuild({ owner: false, permissions: '32' })).toBe(true);
    expect(canManageGuild({ owner: false, permissions: '2048' })).toBe(false);
    expect(canManageGuild({ owner: false, permissions: 'garbage' })).toBe(false);
  });
});

describe('auth helpers', () => {
  it('only allows dashboard and admin paths as post-login redirect', () => {
    expect(safeReturnTo('/dashboard/123')).toBe('/dashboard/123');
    expect(safeReturnTo('/admin')).toBe('/admin');
    expect(safeReturnTo('/admin/servers/123')).toBe('/admin/servers/123');
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '/other', '/admin?next=https://evil.com', undefined, 5]) {
      expect(safeReturnTo(bad)).toBe('/dashboard');
    }
  });
});

describe('discord cdn', () => {
  it('falls back to a default avatar', () => {
    expect(userAvatarUrl('80351110224678912', null)).toMatch(/embed\/avatars\/[0-5]\.png$/);
    expect(userAvatarUrl('80351110224678912', 'abc')).toContain('/avatars/80351110224678912/abc.png');
  });
});

describe('semaphore', () => {
  it('limits concurrency', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        sem.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 10));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});
