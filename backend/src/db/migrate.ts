import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
  const migrationsFolder = join(__dirname, '..', '..', 'drizzle');
  try {
    const adopted = await adoptExistingSchema(sql, migrationsFolder);
    if (adopted) console.log('Existing database schema recorded as the initial migration');
    await migrate(drizzle(sql), { migrationsFolder });
    console.log('Migrations applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function adoptExistingSchema(sql: ReturnType<typeof postgres>, migrationsFolder: string): Promise<boolean> {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ tag: string; when: number }>;
  };
  const initialMigration = journal.entries[0];
  if (!initialMigration) throw new Error('No initial database migration is defined');
  const migrationSql = readFileSync(join(migrationsFolder, `${initialMigration.tag}.sql`), 'utf8');
  const hash = createHash('sha256').update(migrationSql).digest('hex');

  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(714829163)`;
    await tx`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await tx`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    const [migrationCount] = await tx<{ count: number }[]>`
      SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    if (migrationCount.count > 0) return false;

    const [schemaState] = await tx<{ complete: boolean }[]>`
      WITH required_columns(table_name, column_name) AS (
        VALUES
          ('audit_logs', 'id'),
          ('audit_logs', 'guild_id'),
          ('audit_logs', 'user_id'),
          ('audit_logs', 'action'),
          ('audit_logs', 'created_at'),
          ('guild_settings', 'guild_id'),
          ('guild_settings', 'welcome'),
          ('guild_settings', 'goodbye'),
          ('guild_settings', 'updated_by'),
          ('guild_settings', 'updated_at'),
          ('guilds', 'id'),
          ('guilds', 'name'),
          ('guilds', 'icon_hash'),
          ('guilds', 'banner_hash'),
          ('guilds', 'owner_id'),
          ('guilds', 'member_count'),
          ('guilds', 'installed'),
          ('guilds', 'joined_at'),
          ('guilds', 'left_at'),
          ('guilds', 'updated_at')
      )
      SELECT
        NOT EXISTS (
          SELECT 1
          FROM required_columns required
          LEFT JOIN information_schema.columns actual
            ON actual.table_schema = 'public'
            AND actual.table_name = required.table_name
            AND actual.column_name = required.column_name
          WHERE actual.column_name IS NULL
        )
        AND (
          SELECT count(*)
          FROM pg_class tables
          JOIN pg_namespace schemas ON schemas.oid = tables.relnamespace
          WHERE schemas.nspname = 'public'
            AND tables.relname IN ('audit_logs', 'guild_settings', 'guilds')
            AND tables.relrowsecurity
        ) = 3
        AND EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('public.guild_settings')
            AND confrelid = to_regclass('public.guilds')
            AND contype = 'f'
        )
        AND to_regclass('public.audit_logs_guild_created_idx') IS NOT NULL
        AS complete
    `;
    if (!schemaState.complete) return false;

    await tx`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${initialMigration.when})
    `;
    return true;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
