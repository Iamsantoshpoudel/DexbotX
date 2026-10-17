// Runs an embedded Postgres in its own Node process. embedded-postgres is ESM-only and Jest's
// CommonJS module loader cannot load it, so the e2e suite spawns this script (like it does redis-server).
// Usage: node embedded-pg.mjs <dataDir> <port> <database>
import EmbeddedPostgres from 'embedded-postgres';

const [dir, port, database] = process.argv.slice(2);
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port: Number(port),
  persistent: false,
  onLog: () => undefined,
  onError: () => undefined,
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

await pg.initialise();
await pg.start();
await pg.createDatabase(database);
console.log('PG_READY');
setInterval(() => undefined, 1 << 30);
