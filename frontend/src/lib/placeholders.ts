/** Client-side copy of backend/src/shared/placeholders.ts, used for the instant text/embed preview. */
export interface PlaceholderContext {
  userId: string;
  username: string;
  displayName: string;
  serverName: string;
  memberCount: number;
}

export const PLACEHOLDERS: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  { key: 'user', label: '{user}', hint: 'Mentions the member' },
  { key: 'username', label: '{username}', hint: 'Their Discord username' },
  { key: 'displayName', label: '{displayName}', hint: 'Their display name' },
  { key: 'server', label: '{server}', hint: 'Server name' },
  { key: 'memberCount', label: '{memberCount}', hint: 'Total members, e.g. 1,204' },
  { key: 'memberCountOrdinal', label: '{memberCountOrdinal}', hint: 'Member number, e.g. 1,204th' },
];

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

export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>#\-[\]()])/g, '\\$1').replace(/@(everyone|here)/gi, '@\u200b$1');
}

export function applyPlaceholders(input: string, ctx: PlaceholderContext, target: 'message' | 'image'): string {
  const message = target === 'message';
  const text = (s: string) => (message ? escapeMarkdown(s) : s);
  return input.replace(/\{(user|username|displayName|server|memberCount|memberCountOrdinal)\}/g, (m, key: string) => {
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
        return m;
    }
  });
}
