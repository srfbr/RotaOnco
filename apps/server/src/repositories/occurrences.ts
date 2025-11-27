import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { occurrences } from "../db/schema/core";
import type { OccurrenceListFilters, OccurrenceRepository } from "../services/occurrences";

export const occurrencesRepository: OccurrenceRepository = {
	async createOccurrence(input) {
		const now = new Date();
		const result = await db.insert(occurrences).values({
			patientId: input.patientId,
			professionalId: input.professionalId,
			kind: input.kind,
			intensity: input.intensity,
			source: input.source,
			notes: input.notes ?? null,
			createdAt: now,
		});

		const extractInsertId = (value: unknown) => {
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
		};

		let insertId: number | null = extractInsertId(result);
		if (!insertId && Array.isArray(result)) {
			for (const entry of result) {
				insertId = extractInsertId(entry);
				if (insertId) {
					break;
				}
			}
		}

		if (insertId && !Number.isNaN(insertId)) {
			const rowById = await db.query.occurrences.findFirst({
				where: eq(occurrences.id, insertId),
			});
			if (rowById) {
				return rowById;
			}
		}

		const fallback = await db.query.occurrences.findFirst({
			where: and(
				eq(occurrences.patientId, input.patientId),
				eq(occurrences.professionalId, input.professionalId),
				eq(occurrences.kind, input.kind),
				eq(occurrences.source, input.source),
				eq(occurrences.createdAt, now),
			),
		});

		if (!fallback) {
			throw new Error("OCCURRENCE_CREATE_FAILED");
		}

		return fallback;
	},

	async listByPatient(patientId: number, filters?: OccurrenceListFilters) {
		const conditions = [eq(occurrences.patientId, patientId)];
		if (filters?.start) {
			conditions.push(gte(occurrences.createdAt, filters.start));
		}
		if (filters?.end) {
			conditions.push(lte(occurrences.createdAt, filters.end));
		}
		if (filters?.kind) {
			conditions.push(eq(occurrences.kind, filters.kind));
		}
		const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
		return db.query.occurrences.findMany({
			where: whereClause,
			orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
		});
	},
};
