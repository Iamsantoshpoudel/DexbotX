import { Injectable } from '@nestjs/common';
import type { APIEmbed } from 'discord.js';
import { applyPlaceholders, PlaceholderContext } from '../shared/placeholders';
import type { MessageContent } from '../shared/message-config';
import { RenderService } from './render.service';

export interface BuiltMessage {
  content?: string;
  embeds: APIEmbed[];
  file?: { name: string; data: Buffer };
}

export interface MessageAssets {
  avatar: Buffer | null;
  banner: Buffer | null;
  /** Uploaded custom background; wins over the server banner. */
  background?: Buffer | null;
}

const FILE_NAME = 'card.png';

/** Turns a stored template into a ready-to-send message. Used by the bot and by the dashboard's test button. */
@Injectable()
export class MessageBuilder {
  constructor(private readonly render: RenderService) {}

  async buildImage(config: MessageContent, ctx: PlaceholderContext, assets: MessageAssets): Promise<Buffer> {
    const img = config.image;
    return this.render.renderCard({
      style: img.style,
      title: applyPlaceholders(img.title, ctx, { target: 'image' }),
      subtitle: applyPlaceholders(img.subtitle, ctx, { target: 'image' }),
      name: ctx.displayName,
      accentColor: img.accentColor,
      avatarShape: img.avatarShape,
      showMemberCount: img.showMemberCount,
      memberCountText: `${ctx.memberCount.toLocaleString('en-US')} members`,
      avatar: assets.avatar,
      banner: assets.background ?? (img.useServerBanner ? assets.banner : null),
    });
  }

  async build(config: MessageContent, ctx: PlaceholderContext, assets: MessageAssets): Promise<BuiltMessage> {
    const out: BuiltMessage = { embeds: [] };

    if (config.content.trim()) {
      out.content = applyPlaceholders(config.content, ctx, { target: 'message' }).slice(0, 2000);
    }

    if (config.image.enabled) {
      out.file = { name: FILE_NAME, data: await this.buildImage(config, ctx, assets) };
    }

    if (config.embed.enabled) {
      const e = config.embed;
      const embed: APIEmbed = { color: parseInt(e.color.slice(1), 16) };
      const title = applyPlaceholders(e.title, ctx, { target: 'message' }).slice(0, 256);
      const description = applyPlaceholders(e.description, ctx, { target: 'message' }).slice(0, 4000);
      const footer = applyPlaceholders(e.footer, ctx, { target: 'image' }).slice(0, 2048);
      if (title) embed.title = title;
      if (description) embed.description = description;
      if (footer.trim()) embed.footer = { text: footer };
      if (out.file) embed.image = { url: `attachment://${out.file.name}` };
      out.embeds.push(embed);
    }

    return out;
  }
}
