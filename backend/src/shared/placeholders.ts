export const PLACEHOLDER_KEYS = ['user', 'username', 'displayName', 'server', 'memberCount', 'memberCountOrdinal'] as const;

export interface PlaceholderContext {
  userId: string;
  username: string;
  displayName: string;
  serverName: string;
  memberCount: number;
}

export function ordinal(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    const mod10 = abs % 10;
    if (mod10 === 1) suffix = 'st';
    else if (mod10 === 2) suffix = 'nd';
    else if (mod10 === 3) suffix = 'rd';
  }
  return `${abs.toLocaleString('en-US')}${suffix}`;
}

/** Escapes Discord markdown and defuses @everyone / @here inside user-controlled names. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>#\-[\]()])/g, '\\$1').replace(/@(everyone|here)/gi, '@\u200b$1');
}

/**
 * Replaces {placeholders}. In a Discord message `{user}` becomes a mention; inside a
 * rendered image it is the plain display name. Unknown placeholders are left untouched.
 */
export function applyPlaceholders(input: string, ctx: PlaceholderContext, opts: { target: 'message' | 'image' }): string {
  const message = opts.target === 'message';
  const text = (s: string) => (message ? escapeMarkdown(s) : s);
  return input.replace(/\{(user|username|displayName|server|memberCount|memberCountOrdinal)\}/g, (_m, key: string) => {
    switch (key) {
      case 'user':
        return message ? `<@${ctx.userId}>` : ctx.displayName;
      case 'username':
        return text(ctx.username);
      case 'displayName':
        return text(ctx.displayName);
      case 'server':
        return text(ctx.serverName);
      case 'memberCount':
        return ctx.memberCount.toLocaleString('en-US');
      case 'memberCountOrdinal':
        return ordinal(ctx.memberCount);
      default:
        return _m;
    }
  });
}
