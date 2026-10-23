import {
  Bell,
  FileText,
  Home,
  LogOut,
  Music,
  ShieldCheck,
  Smile,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: (guildId: string) => string;
  section: 'server' | 'modules' | 'soon';
  soon?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Home, href: (guildId) => `/dashboard/${guildId}/overview`, section: 'server' },
  { id: 'welcome', label: 'Welcome Messages', icon: UserPlus, href: (guildId) => `/dashboard/${guildId}/welcome`, section: 'modules' },
  { id: 'goodbye', label: 'Goodbye Messages', icon: LogOut, href: (guildId) => `/dashboard/${guildId}/goodbye`, section: 'modules' },
  { id: 'music', label: 'Music', icon: Music, href: (guildId) => `/dashboard/${guildId}/music`, section: 'modules' },
  { id: 'social', label: 'Social Notifications', icon: Bell, href: (guildId) => `/dashboard/${guildId}/social`, section: 'modules' },
  { id: 'moderation', label: 'Auto Moderation', icon: ShieldCheck, section: 'soon', soon: true },
  { id: 'logging', label: 'Logging', icon: FileText, section: 'soon', soon: true },
  { id: 'join-roles', label: 'Join Roles', icon: Users, section: 'soon', soon: true },
  { id: 'reaction-roles', label: 'Reaction Roles', icon: Smile, section: 'soon', soon: true },
];