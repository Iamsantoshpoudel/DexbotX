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
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dexbotx.vercel.app',
  title: 'DexBotX · Discord All in One Bot',
  description: 'DexBotX is a free public Discord bot by DexGameX that is all in one Discord bot . Easy dashboard, no setup pain.',
  keywords: [
    'DexBotX',
    'DexGameX',
    'Discord bot',
    'Discord welcome bot',
    'Discord goodbye bot',
    'welcome message bot',
    'welcome card',
    'Discord automation bot',
    'free Discord bot',
    'Discord server bot',
    'Discord dashboard',
  ],
  tagline: 'Discord Bot Developed by Dexgamex',
  creator: 'dexgamex',
  creatorDisplayName: 'DexGameX',
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/Iamsantoshpoudel',
  discordServerUrl: process.env.NEXT_PUBLIC_DISCORD_SERVER_URL ?? 'https://discord.gg/RVy67hyCZ',
  bannerGif: process.env.NEXT_PUBLIC_BANNER_GIF ?? '/dexbotx-banner-v1.gif',
} satisfies SiteConfig;
