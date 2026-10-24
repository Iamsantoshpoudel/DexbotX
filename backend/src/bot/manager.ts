import 'dotenv/config';
import { ShardingManager } from 'discord.js';
import { join } from 'node:path';
import pino from 'pino';
import { loadConfig } from '../core/config';

/**
 * Entry point for the bot. Spawns one process per configured Discord shard.
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

  const stop = async () => {
    log.info('shutting down shards');
    await Promise.allSettled([...manager.shards.values()].map((shard) => shard.kill()));
    process.exitCode = 0;
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());

  await manager.spawn({ timeout: 180_000 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
