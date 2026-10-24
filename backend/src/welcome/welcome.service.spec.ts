import { GuildRow } from '../db/schema';
import { AssetFetcher } from '../render/asset-fetcher.service';
import { MessageBuilder } from '../render/message-builder.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { AssetStorage } from '../storage/asset-storage.service';
import { defaultMessageConfig } from '../shared/message-config';
import { GuildsService } from '../guilds/guilds.service';
import { DiscordRestService } from '../discord/discord-rest.service';
import { DatabaseService } from '../db/database.service';
import { SessionData } from '../common/types';
import { WelcomeService } from './welcome.service';
import { RedisService } from '../redis/redis.service';

describe('WelcomeService sample assets', () => {
  const assetBuffer = Buffer.from('asset');
  const assets = { fetch: jest.fn().mockResolvedValue(assetBuffer) };
  const storage = { get: jest.fn().mockResolvedValue(assetBuffer) };
  const cardCache = new Map<string, Buffer>();
  const builder = { buildImage: jest.fn().mockResolvedValue(Buffer.from('rendered card')) };
  const service = new WelcomeService(
    {} as DatabaseService,
    {} as SettingsCache,
    {} as GuildsService,
    {} as DiscordRestService,
    {} as never,
    builder as unknown as MessageBuilder,
    assets as unknown as AssetFetcher,
    storage as unknown as AssetStorage,
    {
      client: {
        getBuffer: jest.fn(async (key: string) => cardCache.get(key) ?? null),
        set: jest.fn(async (key: string, value: Buffer) => {
          cardCache.set(key, Buffer.from(value));
          return 'OK';
        }),
      },
    } as unknown as RedisService,
  );
  const guild = { id: '123456789012345678', bannerHash: 'banner-hash' } as GuildRow;
  const session: SessionData = {
    userId: '234567890123456789',
    username: 'dex',
    globalName: null,
    avatarHash: 'avatar-hash',
    accessTokenEnc: '',
    createdAt: 0,
    expiresAt: 0,
  };

  beforeEach(() => {
    assets.fetch.mockClear();
    storage.get.mockClear();
    builder.buildImage.mockClear();
    cardCache.clear();
  });

  it('does not fetch image assets when card images are disabled', async () => {
    const config = defaultMessageConfig('welcome');
    config.image.enabled = false;

    const result = await service['sampleAssets'](guild, session, config);

    expect(result).toEqual({ avatar: null, banner: null, background: null });
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('fetches the banner only when selected, and alongside the avatar', async () => {
    const config = defaultMessageConfig('welcome');
    config.image.useServerBanner = false;
    await service['sampleAssets'](guild, session, config);
    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(assets.fetch).toHaveBeenCalledWith('https://cdn.discordapp.com/avatars/234567890123456789/avatar-hash.png?size=256');

    assets.fetch.mockClear();
    config.image.useServerBanner = true;
    await service['sampleAssets'](guild, session, config);
    expect(assets.fetch).toHaveBeenCalledTimes(2);
    expect(assets.fetch).toHaveBeenCalledWith('https://cdn.discordapp.com/banners/123456789012345678/banner-hash.png?size=1024');
  });

  it('does not fetch the server banner when a custom background overrides it', async () => {
    const config = defaultMessageConfig('welcome');
    config.image.useServerBanner = true;
    config.image.backgroundPath = `${guild.id}/background.png`;

    await service['sampleAssets'](guild, session, config);

    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(assets.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/banners/'));
    expect(storage.get).toHaveBeenCalledWith(config.image.backgroundPath);
  });

  it('falls back to the selected server banner if the custom background is missing', async () => {
    const config = defaultMessageConfig('welcome');
    config.image.useServerBanner = true;
    config.image.backgroundPath = `${guild.id}/missing.png`;
    storage.get.mockResolvedValueOnce(null);

    const result = await service['sampleAssets'](guild, session, config);

    expect(result.banner).toBe(assetBuffer);
    expect(assets.fetch).toHaveBeenCalledWith('https://cdn.discordapp.com/banners/123456789012345678/banner-hash.png?size=1024');
  });

  it('reuses rendered cards and changes keys when image inputs or asset hashes change', async () => {
    const config = defaultMessageConfig('welcome');
    const first = await service.preview(guild, session, config);
    const same = await service.preview(guild, session, config);
    const notModified = await service.preview(guild, session, config, `"${first.imageKey}"`);

    expect(same.buffer).toEqual(first.buffer);
    expect(same.imageKey).toBe(first.imageKey);
    expect(notModified.notModified).toBe(true);
    expect(builder.buildImage).toHaveBeenCalledTimes(1);

    const changedTitle = { ...config, image: { ...config.image, title: 'Changed' } };
    const changedAvatar = { ...session, avatarHash: 'new-avatar' };
    const changedBanner = { ...guild, bannerHash: 'new-banner' };
    expect((await service.preview(guild, session, changedTitle)).imageKey).not.toBe(first.imageKey);
    expect((await service.preview(guild, changedAvatar, config)).imageKey).not.toBe(first.imageKey);
    expect((await service.preview(changedBanner, session, config)).imageKey).not.toBe(first.imageKey);
    expect(builder.buildImage).toHaveBeenCalledTimes(4);
  });
});
