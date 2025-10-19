import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { alerts } from "../db/schema/core";
import type { AlertRepository } from "../services/alerts";

function clampLimit(limit?: number) {
	if (!limit) return 20;
	return Math.max(1, Math.min(limit, 100));
}

async function fetchAlertById(id: number) {
	const alert = await db.query.alerts.findFirst({ where: eq(alerts.id, id) });
	return alert ?? null;
}

export const alertsRepository: AlertRepository = {
	async list({ status, severity, limit, offset }) {
		const cappedLimit = clampLimit(limit);
		const normalizedOffset = offset ?? 0;

		const conditions = [] as Array<ReturnType<typeof eq>>;
		if (status) {
			conditions.push(eq(alerts.status, status));
		}
		if (severity) {
			conditions.push(eq(alerts.severity, severity));
		}

		const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

		let dataQuery = db.select().from(alerts);
		if (whereCondition) {
			dataQuery = dataQuery.where(whereCondition);
		}
		dataQuery = dataQuery.orderBy(desc(alerts.createdAt)).limit(cappedLimit).offset(normalizedOffset);
		const dataRows = await dataQuery;

		let countQuery = db.select({ count: sql<number>`COUNT(${alerts.id})` }).from(alerts);
		if (whereCondition) {
			countQuery = countQuery.where(whereCondition);
		}
		const countRows = await countQuery;
		const total = countRows[0]?.count ?? 0;

		return {
			data: dataRows,
			total,
		};
	},

	async findById(id) {
		return fetchAlertById(id);
	},

	async update(id, update) {
		const updateValues: Partial<typeof alerts.$inferSelect> = {};
		if (update.status !== undefined) {
			updateValues.status = update.status;
		}
		if (update.details !== undefined) {
			updateValues.details = update.details;
		}
		if (update.resolvedAt !== undefined) {
			updateValues.resolvedAt = update.resolvedAt;
		}
		if (update.resolvedBy !== undefined) {
			updateValues.resolvedBy = update.resolvedBy;
		}
		if (Object.keys(updateValues).length === 0) {
			return fetchAlertById(id);
		}
		await db.update(alerts).set(updateValues).where(eq(alerts.id, id));
		return fetchAlertById(id);
	},
};
