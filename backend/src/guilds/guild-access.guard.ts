import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthedRequest } from '../common/types';
import { GuildsService } from './guilds.service';

/**
 * Authorization for every /guilds/:guildId/* route. The guild id from the URL is never trusted:
 * the user must own the server or have Manage Server / Administrator in it (checked against Discord),
 * and the bot must actually be installed there.
 */
@Injectable()
export class GuildAccessGuard implements CanActivate {
  constructor(private readonly guilds: GuildsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const guildId = req.params.guildId as string;
    req.guild = await this.guilds.authorizeInstalledGuild(req.session, guildId, req.sid);
    return true;
  }
}
