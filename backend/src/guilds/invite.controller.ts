import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, RateLimit } from '../common/decorators';
import { GuildsService } from './guilds.service';

@Controller('invite')
export class InviteController {
  constructor(private readonly guilds: GuildsService) {}

  /** The "Add to Discord" button: redirects to Discord's bot authorization screen with minimal permissions. */
  @Public()
  @Get()
  @RateLimit('invite', 60)
  invite(@Res() res: Response): void {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, this.guilds.inviteUrl());
  }
}
