import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { occurrences } from "../db/schema/core";
import type { OccurrenceListFilters, OccurrenceRepository } from "../services/occurrences";

export const occurrencesRepository: OccurrenceRepository = {
	async createOccurrence(input) {
		const result = await db.insert(occurrences).values({
			patientId: input.patientId,
			professionalId: input.professionalId,
			kind: input.kind,
			intensity: input.intensity,
			source: input.source,
			notes: input.notes ?? null,
		});

		const insertId = Number((result as { insertId?: number }).insertId);
		if (!insertId || Number.isNaN(insertId)) {
			throw new Error("OCCURRENCE_CREATE_FAILED");
		}

		const row = await db.query.occurrences.findFirst({
			where: eq(occurrences.id, insertId),
		});

		if (!row) {
			throw new Error("OCCURRENCE_CREATE_FAILED");
		}

		return row;
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
