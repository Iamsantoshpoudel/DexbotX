import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const unbanCommand = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from this server')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption((option) => option
    .setName('user_id')
    .setDescription('Discord user ID')
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(20)
    .setAutocomplete(false))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the unban').setMaxLength(400));
