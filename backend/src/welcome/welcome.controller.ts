import { Body, Controller, HttpCode, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession, RateLimit } from '../common/decorators';
import type { AuthedRequest, SessionData } from '../common/types';
import { ParseKindPipe, ZodValidationPipe } from '../common/zod-validation.pipe';
import { GuildAccessGuard } from '../guilds/guild-access.guard';
import { MessageConfig, MessageKind, messageConfigSchema } from '../shared/message-config';
import { WelcomeService } from './welcome.service';

@Controller('guilds/:guildId/messages')
@UseGuards(GuildAccessGuard)
export class WelcomeController {
  constructor(private readonly welcome: WelcomeService) {}

  @Put(':kind')
  @RateLimit('messages-save', 30)
  async save(
    @Param('kind', new ParseKindPipe()) kind: MessageKind,
    @Body(new ZodValidationPipe(messageConfigSchema)) body: MessageConfig,
    @CurrentSession() session: SessionData,
    @Req() req: AuthedRequest,
  ) {
    return { config: await this.welcome.save(req.guild!, session, kind, body) };
  }

  /** Renders the real card with the logged-in user's avatar, so the dashboard preview matches what the bot posts. */
  @Post(':kind/preview')
  @HttpCode(200)
  @RateLimit('messages-preview', 40)
  async preview(
    @Param('kind', new ParseKindPipe()) _kind: MessageKind,
    @Body(new ZodValidationPipe(messageConfigSchema)) body: MessageConfig,
    @CurrentSession() session: SessionData,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.welcome.preview(req.guild!, session, body);
    res.setHeader('Cache-Control', 'no-store');
    res.type('image/png').send(png);
  }

  @Post(':kind/test')
  @HttpCode(200)
  @RateLimit('messages-test', 6)
  async test(
    @Param('kind', new ParseKindPipe()) kind: MessageKind,
    @CurrentSession() session: SessionData,
    @Req() req: AuthedRequest,
  ) {
    return this.welcome.sendTest(req.guild!, session, kind);
  }
}
