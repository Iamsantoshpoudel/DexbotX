import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { moderationCommands } from '../src/bot/commands';

async function main(): Promise<void> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!clientId || !/^\d{17,20}$/.test(clientId)) {
    throw new Error('DISCORD_CLIENT_ID must be set to a valid Discord application ID.');
  }
  if (!token) throw new Error('DISCORD_BOT_TOKEN must be set.');

  const args = process.argv.slice(2);
  const guildArgIndex = args.indexOf('--guild');
  const guildId = guildArgIndex >= 0 ? args[guildArgIndex + 1] : undefined;
  if (guildArgIndex >= 0 && (!guildId || !/^\d{17,20}$/.test(guildId))) {
    throw new Error('--guild must be followed by a valid Discord server ID.');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: moderationCommands.map((command) => command.toJSON()) });
  console.log(`Registered ${moderationCommands.length} moderation commands${guildId ? ` for guild ${guildId}` : ' globally'}.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown command registration failure';
  console.error(`Command registration failed: ${message}`);
  process.exitCode = 1;
});
