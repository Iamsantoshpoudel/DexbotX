import { Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Guild } from 'discord.js';
import { DatabaseService } from '../db/database.service';
import { guilds } from '../db/schema';

/** Keeps the `guilds` table in step with the servers this shard is in. The API reads it to know where the bot is installed. */
@Injectable()
export class GuildSyncService {
  private readonly logger = new Logger(GuildSyncService.name);

  constructor(private readonly database: DatabaseService) {}

  private toRow(g: Guild) {
    return {
      id: g.id,
      name: g.name,
      iconHash: g.icon,
      bannerHash: g.banner,
      ownerId: g.ownerId,
      memberCount: g.memberCount,
      installed: true,
      leftAt: null,
      updatedAt: new Date(),
    };
  }

  async upsertMany(list: Guild[]): Promise<void> {
    for (let i = 0; i < list.length; i += 200) {
      const rows = list.slice(i, i + 200).map((g) => this.toRow(g));
      await this.database.db
        .insert(guilds)
        .values(rows)
        .onConflictDoUpdate({
          target: guilds.id,
          set: {
            name: sql`excluded.name`,
            iconHash: sql`excluded.icon_hash`,
            bannerHash: sql`excluded.banner_hash`,
            ownerId: sql`excluded.owner_id`,
            memberCount: sql`excluded.member_count`,
            installed: true,
            leftAt: null,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
    this.logger.log(`Synced ${list.length} guild(s)`);
  }

  async upsert(g: Guild): Promise<void> {
    await this.upsertMany([g]);
  }

  async markLeft(guildId: string): Promise<void> {
    await this.database.db
      .update(guilds)
      .set({ installed: false, leftAt: new Date(), updatedAt: new Date() })
      .where(eq(guilds.id, guildId));
  }
}
