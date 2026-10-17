import 'dotenv/config';
import { ShardingManager } from 'discord.js';
import { join } from 'node:path';
import pino from 'pino';
import { loadConfig } from '../core/config';

/**
 * Entry point for the bot. Spawns one process per group of Discord shards.
 * Sharding is required by Discord once a bot is in 2,500 servers; "auto" asks Discord for the right count.
 */
async function main() {
  const config = loadConfig();
  const log = pino({ level: config.logLevel, name: 'shard-manager' });

  const manager = new ShardingManager(join(__dirname, 'shard.js'), {
    token: config.discordBotToken,
    totalShards: config.shardCount,
    respawn: true,
  });

  manager.on('shardCreate', (shard) => {
    log.info({ shard: shard.id }, 'shard launched');
    shard.on('death', () => log.error({ shard: shard.id }, 'shard process died; respawning'));
    shard.on('disconnect', () => log.warn({ shard: shard.id }, 'shard disconnected'));
    shard.on('ready', () => log.info({ shard: shard.id }, 'shard ready'));
  });

  const stop = () => {
    log.info('shutting down shards');
    manager.shards.forEach((s) => s.kill());
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  await manager.spawn({ timeout: 180_000 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
