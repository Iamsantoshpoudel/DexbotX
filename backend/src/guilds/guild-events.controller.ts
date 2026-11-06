import { Controller, MessageEvent, Req, Sse } from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { CurrentSession, RateLimit } from '../common/decorators';
import type { AuthedRequest, SessionData } from '../common/types';
import { GuildsService } from './guilds.service';
import { GuildEventsService } from './guild-events.service';

@Controller()
export class GuildEventsController {
  constructor(
    private readonly guildEvents: GuildEventsService,
    private readonly guilds: GuildsService,
  ) {}

  @Sse('events/guilds')
  @RateLimit('guild-events', 30)
  stream(@CurrentSession() session: SessionData, @Req() req: AuthedRequest): Observable<MessageEvent> {
    return from(this.guilds.listForUser(session, req.sid)).pipe(
      switchMap((guilds) =>
        this.guildEvents.stream(new Set(guilds.filter((guild) => guild.botInstalled).map((guild) => guild.id))),
      ),
    );
  }
}
