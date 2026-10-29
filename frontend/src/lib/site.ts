interface SiteConfig {
  name: string;
  brandName: string;
  url: string;
  title: string;
  description: string;
  keywords: readonly string[];
  tagline: string;
  creator: string;
  creatorDisplayName: string;
  githubUrl: string;
  discordServerUrl: string;
  bannerGif: string;
}

export const SITE = {
  name: 'Dexbotx',
  brandName: 'DexBotX',
  url: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dexbotx.vercel.app').origin,
  title: 'DexBotX: Free Open Source Discord Bot for Your Server',
  description: 'DexBotX is a free, open source Discord bot for welcome messages, moderation, auto roles, anti-spam, social alerts, and AI chat from one dashboard.',
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
  tagline: 'Free, open source Discord automation developed by dexgamex',
  creator: 'dexgamex',
  creatorDisplayName: 'DexGameX',
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/Iamsantoshpoudel',
  discordServerUrl: process.env.NEXT_PUBLIC_DISCORD_SERVER_URL ?? 'https://discord.gg/RVy67hyCZ',
  bannerGif: process.env.NEXT_PUBLIC_BANNER_GIF ?? '/dexbotx-banner-v1.gif',
} satisfies SiteConfig;
