import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import { PUBLIC_KEY } from '../common/decorators';
import { GuildsService } from './guilds.service';
import { InviteController } from './invite.controller';

describe('InviteController', () => {
  it('allows bot invites without a DexBotX session', () => {
    const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=client&scope=bot';
    const guilds = { inviteUrl: jest.fn(() => inviteUrl) } as unknown as GuildsService;
    const controller = new InviteController(guilds);
    const response = {
      setHeader: jest.fn(),
      redirect: jest.fn(),
    } as unknown as Response;

    expect(Reflect.getMetadata(PUBLIC_KEY, InviteController.prototype.invite)).toBe(true);

    controller.invite(response);

    expect(guilds.inviteUrl).toHaveBeenCalledTimes(1);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.redirect).toHaveBeenCalledWith(302, inviteUrl);
  });
});
