import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { alerts, occurrences, patientContacts, patients } from "../db/schema/core";
import type { PatientManagementRepository } from "../services/patient-management";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(limit?: number) {
	if (!limit) return DEFAULT_LIMIT;
	return Math.max(1, Math.min(limit, MAX_LIMIT));
}

export const patientManagementRepository: PatientManagementRepository = {
	async listPatients({ q, status, stage, limit, offset }) {
		const cappedLimit = clampLimit(limit);
		const normalizedOffset = offset ?? 0;

		const filters: SQL[] = [];
		if (typeof q === "string" && q.trim().length > 0) {
			const term = `%${q.trim()}%`;
			filters.push(sql`${patients.fullName} LIKE ${term} OR ${patients.cpf} LIKE ${term}`);
		}
		if (status) {
			filters.push(eq(patients.status, status));
		}
		if (stage) {
			filters.push(eq(patients.stage, stage));
		}

		let whereClause: ReturnType<typeof eq> | undefined;
		if (filters.length === 1) {
			whereClause = filters[0];
		} else if (filters.length > 1) {
			whereClause = and(...filters);
		}

		const dataRows = await db.query.patients.findMany({
			columns: {
				id: true,
				fullName: true,
				cpf: true,
				stage: true,
				status: true,
				createdAt: true,
			},
			...(whereClause ? { where: whereClause } : {}),
			orderBy: (table, { desc }) => [desc(table.createdAt)],
			limit: cappedLimit,
			offset: normalizedOffset,
		});

		const countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(patients);
		const countRows = whereClause ? await countQuery.where(whereClause) : await countQuery;
		const total = countRows[0]?.count ?? 0;

		return {
			data: dataRows.map((row) => ({
				id: row.id,
				fullName: row.fullName,
				cpf: row.cpf,
				stage: row.stage,
				status: row.status,
			})),
			total,
		};
	},

	async createPatient(input) {
		return db.transaction(async (tx) => {
			const insertResult = await tx.insert(patients).values({
				fullName: input.fullName,
				cpf: input.cpf,
				birthDate: input.birthDate ?? null,
				phone: input.phone ?? null,
				emergencyPhone: input.emergencyPhone ?? null,
				tumorType: input.tumorType ?? null,
				clinicalUnit: input.clinicalUnit ?? null,
				stage: input.stage ?? "pre_triage",
				status: input.status ?? "active",
				audioMaterialUrl: input.audioMaterialUrl ?? null,
				pinHash: input.pinHash,
				pinAttempts: 0,
				pinBlockedUntil: null,
				updatedAt: new Date(),
			});

			const insertId = Number((insertResult as { insertId?: number }).insertId);
			if (!insertId || Number.isNaN(insertId)) {
				throw new Error("PATIENT_CREATE_FAILED");
			}

			if (input.contacts && input.contacts.length > 0) {
				await tx.insert(patientContacts).values(
					input.contacts.map((contact) => ({
						patientId: insertId,
						name: contact.fullName,
						relation: contact.relation,
						phone: contact.phone,
					})),
				);
			}

			const patient = await tx.query.patients.findFirst({ where: eq(patients.id, insertId) });
			if (!patient) {
				throw new Error("PATIENT_CREATE_FAILED");
			}
			return patient;
		});
	},

	async searchPatients(query: string, limit = 10) {
		const cappedLimit = clampLimit(limit);
		const term = `%${query.trim()}%`;
		const rows = await db.query.patients.findMany({
			columns: {
				id: true,
				fullName: true,
				cpf: true,
				stage: true,
				status: true,
			},
			where: sql`${patients.fullName} LIKE ${term} OR ${patients.cpf} LIKE ${term}`,
			orderBy: (table, { asc }) => [asc(table.fullName)],
			limit: cappedLimit,
		});
		return rows;
	},

	async getPatientDetail(id: number) {
		const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
		if (!patient) {
			return null;
		}

		const [contactsRows, occurrencesRows, alertsRows] = await Promise.all([
			db.query.patientContacts.findMany({ where: eq(patientContacts.patientId, id) }),
			db.query.occurrences.findMany({ where: eq(occurrences.patientId, id), orderBy: (table, { desc }) => [desc(table.createdAt)] }),
			db.query.alerts.findMany({ where: eq(alerts.patientId, id), orderBy: (table, { desc }) => [desc(table.createdAt)] }),
		]);

		return {
			patient,
			contacts: contactsRows,
			occurrences: occurrencesRows,
			alerts: alertsRows,
		};
	},
};
