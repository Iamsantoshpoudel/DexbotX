import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const timeoutCommand = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Timeout a member')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('member').setDescription('Member to timeout').setRequired(true))
  .addStringOption((option) => option
    .setName('duration')
    .setDescription('Timeout duration')
    .setRequired(true)
    .addChoices(
      { name: '60 seconds', value: '60' },
      { name: '5 minutes', value: '300' },
      { name: '10 minutes', value: '600' },
      { name: '1 hour', value: '3600' },
      { name: '1 day', value: '86400' },
      { name: '1 week', value: '604800' },
    ))
  .addStringOption((option) => option.setName('reason').setDescription('Reason for the timeout').setMaxLength(400));
