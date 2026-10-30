interface SiteConfig {
  brandName: string;
  title: string;
  description: string;
  keywords: readonly string[];
  tagline: string;
  creator: string;
  siteUrl: string;
  githubUrl: string;
  discordSupportUrl: string;
  youtubeProfileUrl?: string;
  profileUrls: readonly string[];
  socialImage: {
    url: string;
    width: number;
    height: number;
  };
}

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/Iamsantoshpoudel';
const youtubeProfileUrl = process.env.NEXT_PUBLIC_YOUTUBE_PROFILE_URL;
const optionalProfileUrls = [
  youtubeProfileUrl,
  process.env.NEXT_PUBLIC_X_PROFILE_URL,
  process.env.NEXT_PUBLIC_TWITCH_PROFILE_URL,
  process.env.NEXT_PUBLIC_INSTAGRAM_PROFILE_URL,
  process.env.NEXT_PUBLIC_LINKEDIN_PROFILE_URL,
].filter((url): url is string => Boolean(url));

export const SITE = {
  brandName: 'DexBotX',
  title: 'DexBotX: Free Open Source Discord Bot for Your Server',
  description:
    'DexBotX is a fast, reliable, free and open-source Discord bot with an easy dashboard for AI chat, social alerts, anti-spam, roles, welcomes, and moderation.',
  keywords: [
    'DexBotX',
    'DexBotX Discord bot',
    'Discord bot',
    'free Discord bot',
    'open source Discord bot',
    'Discord moderation bot',
    'Discord welcome bot',
    'Discord auto role bot',
    'Discord anti spam bot',
    'Discord YouTube notification bot',
    'Discord Kick notification bot',
    'Discord AI chat bot',
    'Discord bot with dashboard',
    'all in one Discord bot',
  ],
  tagline:
    'Fast and reliable Discord automation, free and open source, with an easy web dashboard, AI auto chat, social notifications, anti-spam, auto roles, welcome and goodbye, and moderation commands.',
  creator: 'DexGameX',
  siteUrl: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dexbotx.vercel.app').origin,
  githubUrl,
  discordSupportUrl:
    process.env.NEXT_PUBLIC_DISCORD_SUPPORT_URL
    ?? process.env.NEXT_PUBLIC_DISCORD_SERVER_URL
    ?? 'https://discord.gg/RVy67hyCZ',
  ...(youtubeProfileUrl ? { youtubeProfileUrl } : {}),
  profileUrls: [githubUrl, ...optionalProfileUrls],
  socialImage: {
    url: '/dexbotx-banner.gif',
    width: 680,
    height: 240,
  },
} satisfies SiteConfig;
