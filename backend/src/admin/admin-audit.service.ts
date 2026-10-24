import { Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { adminAudit } from '../db/schema';

@Injectable()
export class AdminAuditService {
  constructor(private readonly database: DatabaseService) {}

  async log(adminId: string, action: string, target: string, details: Record<string, unknown> = {}): Promise<void> {
    await this.database.db.insert(adminAudit).values({ adminId, action, target, details });
  }

  async recent(limit = 100) {
    return this.database.db
      .select({
        id: adminAudit.id,
        adminId: adminAudit.adminId,
        action: adminAudit.action,
        target: adminAudit.target,
        details: adminAudit.details,
        createdAt: adminAudit.createdAt,
      })
      .from(adminAudit)
      .orderBy(desc(adminAudit.createdAt))
      .limit(Math.max(1, Math.min(500, limit)));
  }

  async page(pageInput = 1, action = '') {
    const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
    const normalizedAction = action.trim().slice(0, 100);
    const filter = normalizedAction ? eq(adminAudit.action, normalizedAction) : undefined;
    const [items, totalRows] = await Promise.all([
      this.database.db
        .select({
          id: adminAudit.id,
          adminId: adminAudit.adminId,
          action: adminAudit.action,
          target: adminAudit.target,
          details: adminAudit.details,
          createdAt: adminAudit.createdAt,
        })
        .from(adminAudit)
        .where(filter)
        .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
        .limit(50)
        .offset((page - 1) * 50),
      this.database.db.select({ total: count() }).from(adminAudit).where(filter),
    ]);
    return {
      items,
      page,
      pageSize: 50,
      total: Number(totalRows[0]?.total ?? 0),
      pages: Math.ceil(Number(totalRows[0]?.total ?? 0) / 50),
    };
  }
}
