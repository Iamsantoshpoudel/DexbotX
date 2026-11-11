const DISCORD_USER_AGENT = /discordbot/i;

export function isDiscordUserAgent(userAgent: string | null): boolean {
  return userAgent !== null && DISCORD_USER_AGENT.test(userAgent);
}
