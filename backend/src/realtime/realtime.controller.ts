import { Controller, Post, Req } from '@nestjs/common';
import { RateLimit } from '../common/decorators';
import type { AuthedRequest } from '../common/types';
import { APP_CONFIG, AppConfig } from '../core/config';
import { RedisService } from '../redis/redis.service';
import { randomToken } from '../shared/crypto';
import { Inject } from '@nestjs/common';

@Controller('ws')
export class RealtimeController {
  constructor(
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('ticket')
  @RateLimit('ws-ticket', 10)
  async createTicket(@Req() req: AuthedRequest): Promise<{ ticket: string; url: string }> {
    const ticket = randomToken(32);
    await this.redis.client.set(`wsticket:${ticket}`, req.session!.userId, 'EX', 30);
    const url = new URL(this.config.wsPublicUrl);
    url.searchParams.set('ticket', ticket);
    return { ticket, url: url.toString() };
  }
}
