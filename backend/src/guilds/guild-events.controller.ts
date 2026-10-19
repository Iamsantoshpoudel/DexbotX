import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RateLimit } from '../common/decorators';
import { GuildEventsService } from './guild-events.service';

@Controller()
export class GuildEventsController {
  constructor(private readonly guildEvents: GuildEventsService) {}

  @Sse('events/guilds')
  @RateLimit('guild-events', 30)
  stream(): Observable<MessageEvent> {
    return this.guildEvents.stream();
  }
}
