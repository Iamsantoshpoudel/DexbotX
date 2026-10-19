import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, RateLimit } from '../common/decorators';
import type { AuthedRequest } from '../common/types';
import { APP_CONFIG, AppConfig } from '../core/config';
import { canManageGuild } from '../shared/permissions';
import { GuildsService } from './guilds.service';

@Controller('bot')
export class BotAddedController {
  constructor(
    private readonly guilds: GuildsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('added')
  @RateLimit('bot-added', 30)
  async added(
    @Query('guild_id') guildId: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const web = this.config.webOrigin;
    const id = typeof guildId === 'string' ? guildId : '';
    if (error || !/^\d{17,20}$/.test(id)) {
      return res.redirect(302, `${web}/dashboard`);
    }
    if (!req.session) {
      return res.redirect(302, `${web}/api/auth/login?returnTo=${encodeURIComponent(`/dashboard/${id}/welcome`)}`);
    }
    try {
      await this.guilds.forgetUserGuilds(req.session.userId);
      const userGuilds = await this.guilds.getUserGuilds(req.session, req.sid);
      const match = userGuilds.find((g) => g.id === id);
      if (!match || !canManageGuild(match)) {
        return res.redirect(302, `${web}/dashboard`);
      }
      const row = await this.guilds.registerIfBotPresent(id);
      return res.redirect(302, row ? `${web}/dashboard/${id}/welcome` : `${web}/dashboard?added=${id}`);
    } catch {
      return res.redirect(302, `${web}/dashboard?added=${id}`);
    }
  }
}
