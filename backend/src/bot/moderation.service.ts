import { Injectable, Logger } from '@nestjs/common';
import {
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type User,
} from 'discord.js';
import { DatabaseService } from '../db/database.service';
import { modActions } from '../db/schema';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../redis/redis.service';
import { moderationGuard, type ModerationAction } from './commands/moderation.guard';

const ACTIONS_PER_MINUTE = 20;

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const action = interaction.commandName as ModerationAction;
    if (!isModerationAction(action) || !interaction.guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const moderator = await this.fetchMember(guild, interaction.user.id);
    if (!moderator) {
      await this.respond(interaction, 'I couldn’t verify your current server permissions.');
      this.count(action, 'failed');
      return;
    }

    const targetUser = action === 'unban'
      ? null
      : interaction.options.getUser(action === 'ban' ? 'user' : 'member', true);
    const targetId = action === 'unban' ? interaction.options.getString('user_id', true) : targetUser!.id;
    if (action === 'unban' && !/^\d{17,20}$/.test(targetId)) {
      await this.respond(interaction, 'Enter a valid Discord user ID (17–20 digits).');
      this.count(action, 'failed');
      return;
    }

    const targetMember = action === 'unban' ? null : await this.resolveTargetMember(interaction, guild, targetUser!);
    if (action !== 'ban' && action !== 'unban' && !targetMember) {
      await this.respond(interaction, 'I couldn’t find that member in this server.');
      this.count(action, 'failed');
      return;
    }

    const permission = permissionFor(action);
    const guardFailure = moderationGuard({
      action,
      guild,
      moderator,
      targetUserId: targetId,
      targetIsBot: targetUser?.bot ?? false,
      targetMember,
      permission,
    });
    if (guardFailure) {
      await this.respond(interaction, guardFailure);
      this.count(action, 'failed');
      return;
    }

    const rateLimit = await this.checkRateLimit(guild.id, moderator.id);
    if (rateLimit) {
      await this.respond(interaction, `Slow down: try again in ${rateLimit}s`);
      this.count(action, 'failed');
      return;
    }

    const userReason = interaction.options.getString('reason')?.trim() || 'No reason given';
    const auditReason = `${moderator.user.tag} (${moderator.id}): ${userReason}`.slice(0, 512);
    const durationSeconds = action === 'timeout'
      ? Number(interaction.options.getString('duration', true))
      : null;

    try {
      if (action === 'kick' || action === 'ban' || action === 'timeout') {
        await this.notifyTarget(targetUser!, guild.name, action, userReason);
      }

      switch (action) {
        case 'kick':
          await guild.members.kick(targetId, auditReason);
          break;
        case 'ban':
          await guild.bans.create(targetId, {
            reason: auditReason,
            deleteMessageSeconds: Number(interaction.options.getString('delete_messages', true)),
          });
          break;
        case 'unban':
          await guild.bans.remove(targetId, auditReason);
          break;
        case 'timeout':
          await targetMember!.timeout(durationSeconds! * 1000, auditReason);
          break;
        case 'untimeout':
          await targetMember!.timeout(null, auditReason);
          break;
      }
    } catch (error) {
      this.logger.warn(`Moderation ${action} failed in guild ${guild.id}`);
      this.count(action, 'failed');
      await interaction.editReply({
        content: friendlyDiscordError(action, error),
        allowedMentions: { parse: [] },
      });
      return;
    }

    this.count(action, 'success');
    try {
      await this.database.db.insert(modActions).values({
        guildId: guild.id,
        moderatorId: moderator.id,
        targetId,
        action,
        reason: userReason,
        durationSeconds,
      });
    } catch {
      this.logger.error(`Moderation ${action} succeeded but audit logging failed in guild ${guild.id}`);
      await interaction.editReply({
        content: `${confirmation(action, targetUser, targetId)} (audit logging is temporarily unavailable)`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    await interaction.editReply({
      content: confirmation(action, targetUser, targetId),
      allowedMentions: { parse: [] },
    });
  }

  private async resolveTargetMember(
    interaction: ChatInputCommandInteraction,
    guild: Guild,
    user: User,
  ): Promise<GuildMember | null> {
    const optionName = interaction.commandName === 'ban' ? 'user' : 'member';
    const resolved = interaction.options.getMember(optionName);
    if (isGuildMember(resolved)) return resolved;
    try {
      return await guild.members.fetch(user.id);
    } catch {
      return null;
    }
  }

  private async fetchMember(guild: Guild, userId: string): Promise<GuildMember | null> {
    try {
      return await guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  private async checkRateLimit(guildId: string, moderatorId: string): Promise<number | null> {
    const key = `moderation:${guildId}:${moderatorId}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, 60);
    if (count <= ACTIONS_PER_MINUTE) return null;
    const ttl = await this.redis.client.ttl(key);
    return Math.max(1, ttl);
  }

  private async notifyTarget(user: User, guildName: string, action: ModerationAction, reason: string): Promise<void> {
    const verb = action === 'kick' ? 'kicked from' : action === 'ban' ? 'banned from' : 'timed out in';
    try {
      await user.send({
        content: `You were ${verb} ${guildName}. Reason: ${reason}`,
        allowedMentions: { parse: [] },
      });
    } catch {
      // Moderation proceeds even when the target has DMs closed.
    }
  }

  async recordUnexpectedFailure(commandName: string): Promise<void> {
    if (isModerationAction(commandName)) this.count(commandName, 'failed');
  }

  private async respond(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    await interaction.editReply({
      content,
      allowedMentions: { parse: [] },
    });
  }

  private count(action: ModerationAction, result: 'success' | 'failed'): void {
    this.metrics.moderationActions.inc({ action, result });
  }
}

function isModerationAction(value: string): value is ModerationAction {
  return ['kick', 'ban', 'unban', 'timeout', 'untimeout'].includes(value);
}

function permissionFor(action: ModerationAction) {
  if (action === 'kick') return PermissionFlagsBits.KickMembers;
  if (action === 'ban' || action === 'unban') return PermissionFlagsBits.BanMembers;
  return PermissionFlagsBits.ModerateMembers;
}

function isGuildMember(value: unknown): value is GuildMember {
  return value instanceof GuildMember;
}

function confirmation(action: ModerationAction, user: User | null, targetId: string): string {
  const tag = user?.tag ?? targetId;
  switch (action) {
    case 'kick': return `✅ Kicked ${tag}`;
    case 'ban': return `✅ Banned ${tag}`;
    case 'unban': return `✅ Unbanned ${tag}`;
    case 'timeout': return `✅ Timed out ${tag}`;
    case 'untimeout': return `✅ Removed timeout for ${tag}`;
  }
}

function friendlyDiscordError(action: ModerationAction, error: unknown): string {
  const code = errorCode(error);
  if (code === 50013 || code === '50013') return `I don’t have permission to ${action}.`;
  if (code === 10007 || code === '10007') return 'That member is no longer in this server.';
  if (code === 10013 || code === '10013') return 'That Discord user could not be found.';
  if (code === 10026 || code === '10026') return 'That user is not banned from this server.';
  return `I couldn’t ${action}. Please try again or check my permissions.`;
}

function errorCode(error: unknown): number | string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && (typeof error.code === 'number' || typeof error.code === 'string')) return error.code;
  if ('rawError' in error && typeof error.rawError === 'object' && error.rawError !== null && 'code' in error.rawError) {
    const code = error.rawError.code;
    if (typeof code === 'number' || typeof code === 'string') return code;
  }
  return undefined;
}
