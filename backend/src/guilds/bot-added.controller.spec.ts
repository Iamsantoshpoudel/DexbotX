import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import type { AuthedRequest } from '../common/types';
import type { AppConfig } from '../core/config';
import { RedisService } from '../redis/redis.service';
import { GuildsService } from './guilds.service';
import { BotAddedController } from './bot-added.controller';

describe('BotAddedController', () => {
  const config = { webOrigin: 'https://dexbotx.example' } as AppConfig;
  const controller = new BotAddedController(
    {} as GuildsService,
    config,
    {} as RedisService,
  );

  it('returns to the public homepage when Discord authorization is cancelled', async () => {
    const response = { redirect: jest.fn() } as unknown as Response;

    await controller.added(
      undefined,
      'access_denied',
      {} as AuthedRequest,
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://dexbotx.example/?error=bot_invite_cancelled',
    );
  });

  it('does not send unauthenticated invite completions to the protected dashboard', async () => {
    const response = { redirect: jest.fn() } as unknown as Response;

    await controller.added(
      '12345678901234567',
      undefined,
      {} as AuthedRequest,
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://dexbotx.example/?notice=bot_added_login_required',
    );
  });
});
