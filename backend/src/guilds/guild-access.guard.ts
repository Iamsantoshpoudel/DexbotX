import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthedRequest } from '../common/types';
import { canManageGuild } from '../shared/permissions';
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
    if (!/^\d{17,20}$/.test(guildId)) throw new BadRequestException('Invalid server id');
    if (!req.session) throw new ForbiddenException();

    const userGuilds = await this.guilds.getUserGuilds(req.session, req.sid);
    const match = userGuilds.find((g) => g.id === guildId);
    if (!match || !canManageGuild(match)) throw new ForbiddenException('You need the Manage Server permission in this server');

    const row = await this.guilds.findInstalled(guildId);
    if (!row) throw new NotFoundException('DexBotX is not in this server yet');
    req.guild = row;
    return true;
  }
}
