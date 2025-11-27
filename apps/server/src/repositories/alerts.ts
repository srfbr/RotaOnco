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

function extractInsertId(value: unknown): number | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const raw = (value as Record<string, unknown>).insertId;
	if (raw === undefined || raw === null) {
		return null;
	}
	if (typeof raw === "number") {
		return Number.isNaN(raw) ? null : raw;
	}
	if (typeof raw === "bigint") {
		return Number(raw);
	}
	if (typeof raw === "string") {
		const parsed = Number(raw);
		return Number.isNaN(parsed) ? null : parsed;
	}
	return null;
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

		const dataRows = await (whereCondition
			? db
				.select()
				.from(alerts)
				.where(whereCondition)
				.orderBy(desc(alerts.createdAt))
				.limit(cappedLimit)
				.offset(normalizedOffset)
			: db
				.select()
				.from(alerts)
				.orderBy(desc(alerts.createdAt))
				.limit(cappedLimit)
				.offset(normalizedOffset));

		const countRows = await (whereCondition
			? db
				.select({ count: sql<number>`COUNT(${alerts.id})` })
				.from(alerts)
				.where(whereCondition)
			: db.select({ count: sql<number>`COUNT(${alerts.id})` }).from(alerts));
		const total = countRows[0]?.count ?? 0;

		return {
			data: dataRows,
			total,
		};
	},

	async findById(id) {
		return fetchAlertById(id);
	},

	async create(input) {
		const status = input.status ?? "open";
		const createdAt = input.createdAt ?? new Date();
		const result = await db.insert(alerts).values({
			patientId: input.patientId,
			kind: input.kind,
			severity: input.severity,
			status,
			details: input.details ?? null,
			createdAt,
		});

		let insertId = extractInsertId(result);
		if (!insertId && Array.isArray(result)) {
			for (const entry of result) {
				insertId = extractInsertId(entry);
				if (insertId) {
					break;
				}
			}
		}

		if (insertId && !Number.isNaN(insertId)) {
			const row = await db.query.alerts.findFirst({ where: eq(alerts.id, insertId) });
			if (row) {
				return row;
			}
		}

		const fallback = await db.query.alerts.findFirst({
			where: and(
				eq(alerts.patientId, input.patientId),
				eq(alerts.kind, input.kind),
				eq(alerts.status, status),
				eq(alerts.severity, input.severity),
				eq(alerts.createdAt, createdAt),
			),
			orderBy: (table, { desc: orderDesc }) => [orderDesc(table.id)],
		});

		if (!fallback) {
			throw new Error("ALERT_CREATE_FAILED");
		}

		return fallback;
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
