import { Inject, Injectable, Logger } from '@nestjs/common';
import { PermissionFlagsBits } from 'discord.js';
import { APP_CONFIG, AppConfig } from '../core/config';
import { RedisService } from '../redis/redis.service';
import { DiscordApiError, DiscordRestService } from './discord-rest.service';

export const BOT_ROLE_NAME = 'DexBotX';

const PERMISSION_BITS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory;
const COOLDOWN_SECONDS = 600;

@Injectable()
export class ChannelAccessService {
  private readonly logger = new Logger(ChannelAccessService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly discord: DiscordRestService,
    private readonly redis: RedisService,
  ) {}

  async ensureChannelAccess(guildId: string, channelId: string): Promise<'fixed' | 'no-manage-roles' | 'failed'> {
    const cooldownKey = `permfix:${guildId}:${channelId}`;
    const claimed = await this.redis.client.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS, 'NX');
    if (claimed !== 'OK') return 'failed';

    try {
      const roles = await this.discord.getGuildRoles(guildId);
      let role = roles.find((candidate) => candidate.name === BOT_ROLE_NAME);
      if (!role) {
        role = await this.discord.createRole(guildId, BOT_ROLE_NAME, PERMISSION_BITS.toString());
      } else if (role.hoist === false) {
        try {
          role = await this.discord.modifyRole(guildId, role.id, { hoist: true });
        } catch (err) {
          if (!(err instanceof DiscordApiError && err.status === 403 && err.discordCode === 50013)) throw err;
        }
      }
      const member = await this.discord.getGuildMember(guildId, this.config.discordClientId);
      if (!member.roles.includes(role.id)) {
        await this.discord.addMemberRole(guildId, this.config.discordClientId, role.id);
      }
      await this.discord.setChannelOverwrite(channelId, role.id, PERMISSION_BITS.toString());
      return 'fixed';
    } catch (err) {
      if (!(err instanceof DiscordApiError)) throw err;
      this.logger.warn(`Permission repair guildId=${guildId} channelId=${channelId} status=${err.status}`);
      if (err.status === 403 && err.discordCode === 50013) return 'no-manage-roles';
      return 'failed';
    }
  }
}
