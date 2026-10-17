import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import { APP_CONFIG, AppConfig } from '../core/config';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export function createSql(config: Pick<AppConfig, 'databaseUrl' | 'databaseSsl' | 'databasePoolMax'>): Sql {
  return postgres(config.databaseUrl, {
    max: config.databasePoolMax,
    ssl: config.databaseSsl ? 'require' : false,
    idle_timeout: 30,
    connect_timeout: 15,
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !/:6543\b/.test(config.databaseUrl),
  });
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly sql: Sql;
  readonly db: Db;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.sql = createSql(config);
    this.db = drizzle(this.sql, { schema });
  }

  async ping(): Promise<void> {
    await this.sql`select 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
