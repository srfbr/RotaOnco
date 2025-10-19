import { db } from "../db";
import { auditLogs } from "../db/schema/core";

export async function insertAuditLog(action: string, entity: string, entityId: number | null, details: Record<string, unknown> = {}, userId?: number | null) {
	await db.insert(auditLogs).values({
		action,
		entity,
		entityId: entityId ?? null,
		details,
		userId: userId ?? null,
	});
}
