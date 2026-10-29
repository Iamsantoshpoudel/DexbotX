import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const untimeoutCommand = new SlashCommandBuilder()
  .setName('untimeout')
  .setDescription('Remove a member’s timeout')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('member').setDescription('Member to untimeout').setRequired(true));
