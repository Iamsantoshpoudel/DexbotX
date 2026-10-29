import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const kickCommand = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from this server')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((option) => option.setName('member').setDescription('Member to kick').setRequired(true))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the kick').setMaxLength(400));
