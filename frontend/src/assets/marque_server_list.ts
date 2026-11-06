import type { StaticImageData } from 'next/image';
import { z } from 'zod';
import rows from './marque_server_list.json';
import bharatCoders from './marqueshowcase/Bharat Coders Community.png';
import chillamChilli from './marqueshowcase/chillamchilli.gif';
import delhiValorant from './marqueshowcase/Delhi Valorant Squad.png';
import desiGamers from './marqueshowcase/Desi Gamers Hub.png';
import gamingTube from './marqueshowcase/gamingtube.png';
import kathmanduChill from './marqueshowcase/Kathmandu Chill Zone.png';
import mumbaiEsports from './marqueshowcase/Mumbai Esports Arena.gif';
import prithvicx from './marqueshowcase/prithvicx.png';
import seoulAnime from './marqueshowcase/Seoul Anime Cafe.gif';
import tokyoLounge from './marqueshowcase/Tokyo Night Lounge .gif';

const SERVER_ICON_NAMES = [
  'Bharat Coders Community.png',
  'chillamchilli.gif',
  'Delhi Valorant Squad.png',
  'Desi Gamers Hub.png',
  'gamingtube.png',
  'Kathmandu Chill Zone.png',
  'Mumbai Esports Arena.gif',
  'prithvicx.png',
  'Seoul Anime Cafe.gif',
  'Tokyo Night Lounge .gif',
] as const;

const SERVER_ICONS = {
  'Bharat Coders Community.png': bharatCoders,
  'chillamchilli.gif': chillamChilli,
  'Delhi Valorant Squad.png': delhiValorant,
  'Desi Gamers Hub.png': desiGamers,
  'gamingtube.png': gamingTube,
  'Kathmandu Chill Zone.png': kathmanduChill,
  'Mumbai Esports Arena.gif': mumbaiEsports,
  'prithvicx.png': prithvicx,
  'Seoul Anime Cafe.gif': seoulAnime,
  'Tokyo Night Lounge .gif': tokyoLounge,
} satisfies Record<(typeof SERVER_ICON_NAMES)[number], StaticImageData>;

const serverSchema = z.object({
  name: z.string().trim().min(1),
  icon: z.enum(SERVER_ICON_NAMES).nullable(),
  members: z.number().int().nonnegative(),
  verified: z.boolean().optional(),
});

export type MarqueeServer = {
  name: string;
  icon: StaticImageData | null;
  members: number;
  verified: boolean;
};

export const MARQUEE_SERVERS: MarqueeServer[] = rows
  .flatMap((row) => {
    const result = serverSchema.safeParse(row);
    if (!result.success) return [];

    return [{
      name: result.data.name,
      icon: result.data.icon ? SERVER_ICONS[result.data.icon] : null,
      members: result.data.members,
      verified: result.data.verified ?? false,
    }];
  })
  .sort((a, b) => b.members - a.members);
