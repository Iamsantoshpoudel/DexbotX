import type { MessageContent, MessageKind } from './message-config';

export interface Preset {
  id: string;
  name: string;
  description: string;
  kind: MessageKind;
  config: MessageContent;
}

const noEmbed = { enabled: false, title: '', description: '', color: '#5b4bff', footer: '' };

export const PRESETS: Preset[] = [
  {
    id: 'welcome-midnight',
    name: 'Midnight card',
    description: 'Dark gradient card with a ringed avatar and member number.',
    kind: 'welcome',
    config: {
      content: 'Welcome to **{server}**, {user}! 🎉',
      embed: noEmbed,
      image: { enabled: true, style: 'midnight', title: 'Welcome', subtitle: 'You are member #{memberCount}', accentColor: '#7c6cff', useServerBanner: false, avatarShape: 'circle', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'welcome-banner',
    name: 'Server banner hero',
    description: 'Uses your server banner as the card background.',
    kind: 'welcome',
    config: {
      content: '{user} just landed in **{server}**.',
      embed: noEmbed,
      image: { enabled: true, style: 'midnight', title: 'Say hi to', subtitle: 'Glad to have you in {server}', accentColor: '#ffffff', useServerBanner: true, avatarShape: 'rounded', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'welcome-neon',
    name: 'Neon arcade',
    description: 'High-contrast neon for gaming communities.',
    kind: 'welcome',
    config: {
      content: 'Player {user} joined the lobby. Welcome to **{server}**!',
      embed: noEmbed,
      image: { enabled: true, style: 'neon', title: 'Player joined', subtitle: 'Read the rules, then say hello', accentColor: '#22d3ee', useServerBanner: false, avatarShape: 'rounded', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'welcome-sunset',
    name: 'Sunset party',
    description: 'Warm, friendly card for social servers.',
    kind: 'welcome',
    config: {
      content: 'Hey {user}, welcome to **{server}**! Grab a seat. 🌅',
      embed: noEmbed,
      image: { enabled: true, style: 'sunset', title: 'Welcome', subtitle: 'Make yourself at home', accentColor: '#fde68a', useServerBanner: false, avatarShape: 'circle', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'welcome-clean',
    name: 'Clean minimal',
    description: 'Quiet card with no decoration. Good for professional servers.',
    kind: 'welcome',
    config: {
      content: 'Welcome, {user}.',
      embed: noEmbed,
      image: { enabled: true, style: 'minimal', title: 'Welcome', subtitle: 'to {server}', accentColor: '#a5b4fc', useServerBanner: false, avatarShape: 'circle', showMemberCount: false, backgroundPath: null },
    },
  },
  {
    id: 'welcome-embed',
    name: 'Cozy embed',
    description: 'Embed with the card image inside it.',
    kind: 'welcome',
    config: {
      content: '{user}',
      embed: { enabled: true, title: 'Welcome to {server}!', description: 'We are glad you are here, {displayName}.\nYou are member **{memberCountOrdinal}**.', color: '#5b4bff', footer: 'Introduce yourself in the chat' },
      image: { enabled: true, style: 'aurora', title: 'Welcome', subtitle: 'Member #{memberCount}', accentColor: '#34d399', useServerBanner: false, avatarShape: 'circle', showMemberCount: false, backgroundPath: null },
    },
  },
  {
    id: 'welcome-text',
    name: 'Text only',
    description: 'A single line. No image, no embed.',
    kind: 'welcome',
    config: {
      content: 'Welcome to **{server}**, {user}! You are member #{memberCount}.',
      embed: noEmbed,
      image: { enabled: false, style: 'midnight', title: 'Welcome', subtitle: '', accentColor: '#7c6cff', useServerBanner: false, avatarShape: 'circle', showMemberCount: false, backgroundPath: null },
    },
  },
  {
    id: 'goodbye-soft',
    name: 'Soft farewell',
    description: 'Warm sunset card with a short goodbye.',
    kind: 'goodbye',
    config: {
      content: '**{username}** just left **{server}**. Take care! 👋',
      embed: noEmbed,
      image: { enabled: true, style: 'sunset', title: 'Goodbye', subtitle: 'We will miss you', accentColor: '#fb923c', useServerBanner: false, avatarShape: 'circle', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'goodbye-ocean',
    name: 'Calm ocean',
    description: 'Cool blue card for a quiet send-off.',
    kind: 'goodbye',
    config: {
      content: '{username} has left the server.',
      embed: noEmbed,
      image: { enabled: true, style: 'ocean', title: 'See you around', subtitle: 'The door is always open', accentColor: '#7dd3fc', useServerBanner: false, avatarShape: 'circle', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'goodbye-minimal',
    name: 'Clean minimal',
    description: 'Plain dark card with no decoration.',
    kind: 'goodbye',
    config: {
      content: '',
      embed: noEmbed,
      image: { enabled: true, style: 'minimal', title: 'Goodbye', subtitle: '{displayName} left {server}', accentColor: '#94a3b8', useServerBanner: false, avatarShape: 'rounded', showMemberCount: true, backgroundPath: null },
    },
  },
  {
    id: 'goodbye-text',
    name: 'Text only',
    description: 'A single line. No image, no embed.',
    kind: 'goodbye',
    config: {
      content: '**{username}** left **{server}**. We are now {memberCount} members.',
      embed: noEmbed,
      image: { enabled: false, style: 'sunset', title: 'Goodbye', subtitle: '', accentColor: '#fb923c', useServerBanner: false, avatarShape: 'circle', showMemberCount: false, backgroundPath: null },
    },
  },
];
