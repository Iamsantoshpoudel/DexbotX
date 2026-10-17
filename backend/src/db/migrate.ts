import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';
import postgres from 'postgres';

/** Applies SQL migrations from ./drizzle. Run once per deploy: npm run db:migrate */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const ssl = process.env.DATABASE_SSL ? process.env.DATABASE_SSL === 'true' : process.env.NODE_ENV === 'production';
  const sql = postgres(url, { max: 1, ssl: ssl ? 'require' : false, prepare: false });
  try {
    await migrate(drizzle(sql), { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
    console.log('Migrations applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
