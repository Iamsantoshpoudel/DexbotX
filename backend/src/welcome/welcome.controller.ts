import { Body, Controller, Delete, HttpCode, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
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
    return this.welcome.save(req.guild!, session, kind, body);
  }

  @Delete(':kind')
  @RateLimit('messages-reset', 10)
  async reset(
    @Param('kind', new ParseKindPipe()) kind: MessageKind,
    @CurrentSession() session: SessionData,
    @Req() req: AuthedRequest,
  ) {
    return this.welcome.reset(req.guild!, session, kind);
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
    const preview = await this.welcome.preview(req.guild!, session, body, req.get('if-none-match'));
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    if (preview.imageKey) {
      const etag = `"${preview.imageKey}"`;
      res.setHeader('X-Card-Key', preview.imageKey);
      res.setHeader('ETag', etag);
    }
    res.type('image/png');
    if (preview.notModified) {
      res.status(304).end();
      return;
    }
    res.send(preview.buffer);
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
