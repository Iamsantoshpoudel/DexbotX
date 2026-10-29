import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const banCommand = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from this server')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) => option.setName('user').setDescription('User to ban; accepts an ID').setRequired(true))
  .addStringOption((option) => option
    .setName('delete_messages')
    .setDescription('Delete the user’s messages')
    .setRequired(true)
    .addChoices(
      { name: 'None', value: '0' },
      { name: '1 day', value: '86400' },
      { name: '7 days', value: '604800' },
    ))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban').setMaxLength(400));
