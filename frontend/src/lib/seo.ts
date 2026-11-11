import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const HOME_SEO = {
  title: SITE.title,
  description: SITE.description,
  keywords: SITE.keywords,
};

export const FAQS = [
  {
    question: 'Is DexBotX free to use?',
    answer:
      'Yes. DexBotX is free to invite and use. There is no subscription required to add the bot to a server and use its available features.',
  },
  {
    question: 'Is DexBotX open source?',
    answer:
      'Yes. DexBotX is open source. You can review the project source in the GitHub repository linked from the About page.',
  },
  {
    question: 'Which Discord permissions does DexBotX need, and why?',
    answer:
      'The Discord authorization screen shows the requested permissions before you approve an installation. DexBotX does not request Administrator. It uses permissions for its features, such as posting configured welcome messages and cards and running moderation commands. Moderation also checks the acting member’s permissions and Discord role hierarchy.',
  },
  {
    question: 'How do I add DexBotX to my server?',
    answer:
      'Use the Add to Discord link, choose a server where you can manage integrations, review the permissions in Discord, and authorize. Then sign in to the dashboard and select a server you can manage.',
  },
  {
    question: 'How do I remove DexBotX from my server?',
    answer:
      'Remove or kick DexBotX from your server using Discord’s server member or Integrations settings. Removing the bot stops it from serving that server. See the privacy policy or contact the maintainer if you also want to request deletion of stored server configuration.',
  },
  {
    question: 'What information does DexBotX store, and how is it protected?',
    answer:
      'The service handles Discord account and server details needed for sign-in and dashboard configuration, along with saved settings and moderation audit records. Discord access tokens stay on the server and are encrypted before storage; the browser receives an HTTP-only session cookie. Read the privacy policy for details and data deletion requests.',
  },
  {
    question: 'Does DexBotX read ordinary Discord messages?',
    answer:
      'No. The bot does not request Discord’s Message Content intent or read ordinary server message text. It does receive member events for join and leave features and slash-command interactions for moderation.',
  },
  {
    question: 'How do I configure welcome and goodbye messages?',
    answer:
      'Add DexBotX, sign in with Discord, choose a server you can manage, and open its welcome or goodbye settings in the dashboard. Select a channel, customize the message and member card, preview it, and save.',
  },
  {
    question: 'Which moderation commands are available?',
    answer:
      'DexBotX provides /kick, /ban, /unban, /timeout, and /untimeout. Each command requires the matching Discord permission and is also subject to the bot’s permissions and role hierarchy. See the Commands page for examples.',
  },
  {
    question: 'Where can I get help or contact the maintainer?',
    answer:
      'Visit the DexBotX support Discord community for help. You can also contact the project maintainer through the GitHub repository linked on the About page.',
  },
] as const;

export const FEATURE_PAGES = [
  {
    slug: 'moderation',
    name: 'Moderation',
    title: 'DexBotX: Discord Moderation Bot for Safer Online Servers',
    description:
      'DexBotX Discord moderation bot helps teams manage moderation, welcome tools, anti-spam, and other automation together from one free, open source dashboard.',
    keywords: ['Discord moderation bot', 'Discord server moderation', 'free Discord bot'],
    intro: [
      'A well-run Discord community needs consistent rules and a clear way for its moderators to respond. DexBotX brings moderation into an all-in-one Discord bot, so server teams can manage moderation alongside member onboarding and other automation instead of juggling disconnected tools.',
      'The web dashboard gives authorized server managers a single place to work with their bot configuration. Pair moderation with welcome and goodbye messages, auto roles, and anti-spam controls to make a more organized experience for both members and moderators.',
    ],
    sections: [
      {
        heading: 'Keep moderation close to your other server tools',
        paragraphs: [
          'Moderation is most useful when it fits the way a community already operates. DexBotX is designed as a shared bot for several server tasks, which means administrators can think about moderation in context with onboarding, roles, and the channels where members gather. This helps keep everyday configuration easier to find as a server grows.',
          'Use the dashboard to review available moderation settings for your server. Access depends on your Discord permissions, and changes should be made by people trusted to manage the community. Start with the controls your team needs and explain the server rules clearly so members understand what behavior is expected.',
        ],
      },
      {
        heading: 'Support a safer, more predictable community',
        paragraphs: [
          'A moderation bot can help teams apply their policies consistently, but automation should support human judgment rather than replace it. Agree on a moderation approach with your team, make sure the right people can access server settings, and check configuration changes when your rules or channels change.',
          'DexBotX also includes anti-spam as part of its broader automation offering. Bringing those needs together can reduce the number of separate tools a team has to configure and maintain. Review the current dashboard options before relying on any automated response, and keep your community guidelines available to members.',
        ],
      },
      {
        heading: 'Configure DexBotX for your server',
        paragraphs: [
          'To begin, add DexBotX to a server where you have permission to manage bots, sign in through Discord, and select that server in the dashboard. Explore the moderation controls available to your account, then review the settings with your moderator team. The dashboard is intended to make configuration approachable without requiring you to memorize command syntax.',
          'If you are setting up a new community, combine moderation planning with a clear welcome message and a sensible role structure. Read about the [Discord welcome bot](/features/welcome-bot), [anti-spam features](/#features), and [auto roles](/features/auto-roles) to see how those parts of the bot fit together.',
        ],
      },
    ],
    related: ['welcome-bot', 'auto-roles', 'youtube-notifications'],
  },
  {
    slug: 'welcome-bot',
    name: 'Welcome and Goodbye',
    title: 'DexBotX: Discord Welcome Bot for Member Messages and Cards',
    description:
      'DexBotX Discord welcome bot creates personal welcome and goodbye messages with custom member cards and straightforward dashboard configuration for your server.',
    keywords: ['Discord welcome bot', 'Discord goodbye bot', 'welcome message bot'],
    intro: [
      'First impressions matter when someone joins a Discord community. DexBotX is a Discord welcome bot that lets server managers configure welcome and goodbye messages in a web dashboard, with personalized member cards to make each greeting feel at home in the server.',
      'Set up the message experience without memorizing a command list. Choose where the message belongs, write copy that reflects your community, and tailor the card design with the dashboard controls and preview. Welcome and goodbye messages can be configured independently.',
    ],
    sections: [
      {
        heading: 'Make new members feel oriented',
        paragraphs: [
          'A useful welcome is more than an announcement that someone arrived. It can point a new member toward the right place to start, introduce the community tone, and invite them to take part. With DexBotX, you can configure a greeting and member card that suit the way your server communicates.',
          'The dashboard supports editable message text and card styling. Available variables can personalize the message for each member, while a live preview helps you review the result as you adjust it. Keep the text readable, link to the right server resources, and avoid overwhelming people with too many instructions at once.',
        ],
      },
      {
        heading: 'Set up separate welcome and goodbye messages',
        paragraphs: [
          'Welcome and goodbye messages have different purposes, so DexBotX treats them as separate configurations. Select a channel for each, choose message content, and adjust the card appearance to match your server. If your community uses different channels for arrivals and departures, configure each flow to fit that structure.',
          'A departure message can close the loop for the rest of the community without exposing private information or making assumptions about why someone left. Review the tone and destination before enabling it, especially in servers where membership changes are frequent.',
        ],
      },
      {
        heading: 'Configure your greeting from the dashboard',
        paragraphs: [
          'Add the bot to your server, sign in with Discord, and choose a server you are allowed to manage. Open the welcome settings, select the channel, customize message text and card options, and review the preview. Repeat the process for goodbye settings if you want to configure departures too.',
          'For a full walkthrough, read [how to add DexBotX to your server](/#how-to-add). You can also explore [auto roles](/features/auto-roles) for member onboarding and [moderation](/features/moderation) for community management. These tools share the same dashboard-first approach.',
        ],
      },
    ],
    related: ['auto-roles', 'moderation', 'ai-chat'],
  },
  {
    slug: 'youtube-notifications',
    name: 'YouTube and Social Notifications',
    title: 'DexBotX: Discord YouTube Notifications for Servers',
    description:
      'DexBotX Discord YouTube notifications keep your community updated, with Kick and more social alerts configured alongside server automation in one dashboard.',
    keywords: ['Discord YouTube notification bot', 'Discord Kick notification bot', 'Discord social notifications'],
    intro: [
      'Creators and community members often want new social activity to reach the right Discord channels. DexBotX brings social notifications, including YouTube and Kick updates, into an all-in-one Discord bot that also offers moderation, welcome messages, auto roles, and more.',
      'Use the dashboard to review available notification sources and configure them for your server. Keeping updates in a dedicated channel can help members find new creator activity without interrupting unrelated conversations or requiring moderators to post every update by hand.',
    ],
    sections: [
      {
        heading: 'Bring creator updates into your server',
        paragraphs: [
          'A notification channel gives your community a predictable place to discover new content. DexBotX is designed to support social notifications from YouTube, Kick, and additional sources as they are available. Decide which updates matter to your members and direct them to channels where those posts are welcome.',
          'Before enabling a feed, consider how often its updates will arrive and whether the destination channel has a clear purpose. A focused channel can keep notifications useful while preserving the flow of discussion elsewhere. Share the channel purpose with members so they know where to find creator updates.',
        ],
      },
      {
        heading: 'Manage notifications with the web dashboard',
        paragraphs: [
          'DexBotX uses a web dashboard for configuration, so server managers can review settings through a visual interface. Sign in with Discord, select a server you can manage, and look for the social notification controls currently available to that server. Choose a suitable channel and follow the dashboard prompts for each source.',
          'Provider features can evolve over time. Check the dashboard and project documentation for current source availability and configuration requirements rather than assuming every provider or notification type is enabled in every deployment.',
        ],
      },
      {
        heading: 'Coordinate notifications with other automation',
        paragraphs: [
          'Social alerts are one piece of server automation. Pair them with [welcome and goodbye messages](/features/welcome-bot) to make onboarding clearer, [moderation tools](/features/moderation) to support community standards, and [auto roles](/features/auto-roles) to organize member access.',
          'If a feed becomes noisy, revisit its destination and the notification options available for that integration. Clear channel organization and thoughtful choices help keep automated posts relevant. DexBotX is free and open source, with its source linked from the site footer.',
        ],
      },
    ],
    related: ['moderation', 'welcome-bot', 'ai-chat'],
  },
  {
    slug: 'ai-chat',
    name: 'AI Auto Chat',
    title: 'DexBotX: Discord AI Chat Bot with Web Dashboard Setup',
    description:
      'DexBotX Discord AI chat bot offers dashboard-led configuration alongside welcome messages, moderation, and other automation in one free server bot.',
    keywords: ['Discord AI chat bot', 'AI auto chat Discord', 'Discord bot with dashboard'],
    intro: [
      'DexBotX includes AI auto chat in its all-in-one Discord bot feature set. It is designed for communities that want automated conversation alongside moderation, welcome and goodbye messages, anti-spam, social notifications, and role management.',
      'Server configuration is handled through a web dashboard, giving authorized managers one place to review the options available to their server. As with any automated conversation feature, make sure its purpose is clear to members and review the controls available in your deployment before enabling it.',
    ],
    sections: [
      {
        heading: 'Use AI chat thoughtfully in a community',
        paragraphs: [
          'Automated chat can add an interactive element to a server, but it should be introduced with clear expectations. Tell members where automated responses may appear, establish appropriate channel boundaries, and make sure moderators know how to manage conversations according to the community rules.',
          'DexBotX provides AI auto chat as part of a broader server toolkit rather than as an isolated chatbot. That allows managers to consider its role alongside onboarding and moderation. Review the available dashboard settings and keep the feature aligned with the norms of your community.',
        ],
      },
      {
        heading: 'Configure available options in the dashboard',
        paragraphs: [
          'To explore AI chat, add DexBotX to your server, authenticate through Discord, and select the server in the dashboard. Review the current AI auto chat controls shown for that server and configure them according to the options actually presented. Feature availability and configuration details may change as the project develops.',
          'Do not share private or sensitive information with an automated chat feature. Set clear usage guidance for members, and use appropriate moderation practices for all conversations. The dashboard is the source of truth for the controls available to your account and server.',
        ],
      },
      {
        heading: 'Connect AI chat to a balanced setup',
        paragraphs: [
          'A healthy Discord setup combines useful automation with human oversight. Consider how AI chat fits alongside [moderation](/features/moderation), [welcome messages](/features/welcome-bot), and [social notifications](/features/youtube-notifications). Keeping each feature purposeful can make the server easier for members to navigate.',
          'DexBotX is free and open source, and its GitHub repository is linked in the footer. For general setup help, visit the [FAQ](/faq) or read the [commands and dashboard guide](/commands), which explains how to work with the visual controls without relying on command memorization.',
        ],
      },
    ],
    related: ['moderation', 'welcome-bot', 'youtube-notifications'],
  },
  {
    slug: 'auto-roles',
    name: 'Auto Roles',
    title: 'DexBotX: Free Discord Auto Role Bot for Onboarding',
    description:
      'DexBotX Discord auto role bot helps organize onboarding with automatic role management, welcome messages, and dashboard controls for your server.',
    keywords: ['Discord auto role bot', 'Discord role automation', 'Discord onboarding bot'],
    intro: [
      'Roles help Discord communities organize access, identity, and member groups. DexBotX includes auto role management in its all-in-one bot feature set, helping server teams connect member onboarding with the rest of their server automation.',
      'Use the dashboard to review available role settings for a server you can manage. Thoughtful role configuration can make a new member experience easier to understand, especially when it is paired with an informative welcome message and clearly explained server channels.',
    ],
    sections: [
      {
        heading: 'Make onboarding more consistent',
        paragraphs: [
          'When members arrive, a role can help place them in the right part of a community. Automation can reduce repetitive setup work for moderators, but the roles themselves should have clear names and permissions. Review what each role allows before connecting it to an automated workflow.',
          'DexBotX brings auto roles together with welcome and goodbye messages, moderation, and other features. This makes it easier to plan onboarding as one experience: greet a new member, help them find the right channels, and use roles to represent the structure your server already intends.',
        ],
      },
      {
        heading: 'Keep permissions deliberate',
        paragraphs: [
          'Discord roles can grant significant permissions, so check the role hierarchy and permission set before enabling automation. Only grant the bot the access required for the tasks you intend to use, and keep administrative permissions assigned to trusted people. Revisit role settings when your server structure changes.',
          'The dashboard provides a visual way to manage the configuration available to your account. Choose a server where you have permission to manage it, inspect the role options presented, and make changes in line with your community policy. If you are unsure about a permission, check Discord’s own documentation before granting it.',
        ],
      },
      {
        heading: 'Set up a role workflow',
        paragraphs: [
          'Start by adding DexBotX to Discord and opening the dashboard. Select your server and review the auto role settings that are available. Make sure the roles exist, their intended members are understood, and channel permissions are consistent before relying on the automation.',
          'Pair auto roles with a clear [welcome message setup](/features/welcome-bot) so members know how to get started. For community management, explore the [moderation bot features](/features/moderation), and visit the [FAQ](/faq) if you need general setup guidance.',
        ],
      },
    ],
    related: ['welcome-bot', 'moderation', 'ai-chat'],
  },
] as const;

export const PUBLIC_PAGE_SEO = {
  features: {
    title: 'DexBotX: Discord Bot Features and Easy Dashboard Setup',
    description:
      'Explore DexBotX: a free, open-source Discord bot for anti-spam, social notifications, AI auto chat, auto roles, welcome and goodbye, auto moderation, and easy dashboard setup.',
    keywords: ['DexBotX features', 'Discord bot features', 'Discord bot dashboard'],
  },
  about: {
    title: 'DexBotX: About the Free Open Source Discord Bot Project',
    description:
      'Meet DexGameX, the developer behind DexBotX. Find its source, join Discord support, and learn about the free, open-source bot for your server.',
    keywords: ['about DexBotX', 'DexBotX developer', 'open source Discord bot'],
  },
  commands: {
    title: 'DexBotX: Discord Moderation Slash Commands and Examples',
    description:
      'See what /kick, /ban, /unban, /timeout, and /untimeout do, who can use them, and examples with the Discord permissions each command requires.',
    keywords: ['DexBotX commands', 'Discord bot dashboard', 'configure Discord bot'],
  },
  faq: {
    title: 'DexBotX: Discord Bot FAQ and Setup Help for Servers',
    description:
      'Get clear answers about DexBotX pricing, permissions, removal, privacy, message access, setup, moderation commands, and support for server owners.',
    keywords: ['DexBotX FAQ', 'Discord bot help', 'DexBotX setup'],
  },
  privacy: {
    title: 'DexBotX: Privacy Policy for Bot and Dashboard Users',
    description:
      'DexBotX Discord bot privacy policy explains how the service handles account details, server configuration, uploaded backgrounds, and dashboard sessions.',
    keywords: ['DexBotX privacy policy', 'Discord bot privacy', 'dashboard privacy'],
  },
  terms: {
    title: 'DexBotX: Terms of Service for Discord Bot and Dashboard',
    description:
      'DexBotX Discord bot terms explain user responsibilities, service availability, and third-party services when using the free bot and dashboard.',
    keywords: ['DexBotX terms of service', 'Discord bot terms', 'DexBotX terms'],
  },
} as const;

export function createPageMetadata({
  path,
  title,
  description,
  keywords = [],
  noindex = false,
}: {
  path: string;
  title: string;
  description: string;
  keywords?: readonly string[];
  noindex?: boolean;
}): Metadata {
  const canonical = path === '/' ? '/' : path;
  return {
    title: { absolute: title },
    description,
    keywords: [...new Set([...HOME_SEO.keywords, ...keywords])],
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'DexBotX Discord Bot',
      title,
      description,
      locale: 'en_US',
      images: [{ ...SITE.socialImage, alt: 'DexBotX, free open source Discord bot' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SITE.socialImage.url],
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  };
}
