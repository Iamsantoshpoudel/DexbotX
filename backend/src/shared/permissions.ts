const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

export interface UserGuildLike {
  owner: boolean;
  permissions: string;
}

/** A user may configure a server if they own it or have Administrator / Manage Server. */
export function canManageGuild(guild: UserGuildLike): boolean {
  if (guild.owner) return true;
  try {
    const p = BigInt(guild.permissions);
    return (p & ADMINISTRATOR) !== 0n || (p & MANAGE_GUILD) !== 0n;
  } catch {
    return false;
  }
}
