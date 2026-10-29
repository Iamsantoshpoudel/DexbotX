import {
  Guild,
  GuildMember,
  PermissionFlagsBits,
  type PermissionResolvable,
} from 'discord.js';

export type ModerationAction = 'kick' | 'ban' | 'unban' | 'timeout' | 'untimeout';

export interface ModerationCheck {
  action: ModerationAction;
  guild: Guild;
  moderator: GuildMember;
  targetUserId: string;
  targetIsBot: boolean;
  targetMember: GuildMember | null;
  permission: PermissionResolvable;
}

export function moderationGuard(check: ModerationCheck): string | null {
  const { action, guild, moderator, targetUserId, targetIsBot, targetMember, permission } = check;
  if (!moderator.permissions.has(permission)) return `You need the ${permissionName(action)} permission to ${action}.`;
  if (targetUserId === guild.ownerId) return 'You can’t moderate the server owner.';
  if (targetUserId === moderator.id) return 'You can’t moderate yourself.';
  if (targetUserId === guild.client.user?.id) return 'You can’t moderate me.';
  const bot = guild.members.me;
  if (!bot) return 'I can’t verify my server permissions right now.';
  if (!bot.permissions.has(permission)) return `I can’t ${action}: I’m missing the ${permissionName(action)} permission.`;

  if (!targetMember) return null;
  if (targetIsBot && targetMember.roles.highest.comparePositionTo(bot.roles.highest) > 0) {
    return 'I can’t moderate that bot: its role is above mine. Move DexBotX’s role above theirs in Server Settings > Roles; Administrator does not bypass role hierarchy.';
  }
  if (moderator.id !== guild.ownerId && moderator.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
    return 'You can’t moderate them: their role is equal to or above yours.';
  }
  if (bot.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
    return `I can’t ${action === 'untimeout' ? 'remove their timeout' : action === 'timeout' ? 'timeout' : action}: their role is equal to or above mine. Move DexBotX’s role above theirs in Server Settings > Roles; Administrator does not bypass role hierarchy.`;
  }
  if (action === 'kick' && !targetMember.kickable) return 'I can’t kick them: Discord says they aren’t kickable.';
  if (action === 'ban' && !targetMember.bannable) return 'I can’t ban them: Discord says they aren’t bannable.';
  if ((action === 'timeout' || action === 'untimeout') && !targetMember.moderatable) {
    return 'I can’t change their timeout: Discord says they aren’t moderatable.';
  }
  return null;
}

function permissionName(action: ModerationAction): string {
  if (action === 'kick') return 'Kick Members';
  if (action === 'ban' || action === 'unban') return 'Ban Members';
  return 'Moderate Members';
}

export { PermissionFlagsBits };
