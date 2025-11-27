import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../db";
import { appointments, occurrences, alerts } from "../db/schema/core";
import type {
	AttendanceReportInput,
	ReportsAppointmentRow,
	ReportsOccurrenceRow,
	ReportsRepository,
	ReportsAlertRow,
} from "../services/reports";

function buildWhereClause(params: AttendanceReportInput) {
	const conditions: SQL[] = [eq(appointments.professionalId, params.professionalId)];
	if (params.start) {
		conditions.push(gte(appointments.startsAt, params.start));
	}
	if (params.end) {
		conditions.push(lte(appointments.startsAt, params.end));
	}
	if (conditions.length === 1) {
		return conditions[0];
	}
	return and(...(conditions as [SQL, ...SQL[]]));
}

export const reportsRepository: ReportsRepository = {
	async fetchAppointments(params): Promise<ReportsAppointmentRow[]> {
		const whereClause = buildWhereClause(params);
		return db.query.appointments.findMany({
			columns: {
				status: true,
				startsAt: true,
				createdAt: true,
				type: true,
				patientId: true,
			},
			where: whereClause,
		});
	},

	async fetchOccurrences(params): Promise<ReportsOccurrenceRow[]> {
		const conditions: SQL[] = [eq(occurrences.professionalId, params.professionalId)];
		if (params.start) {
			conditions.push(gte(occurrences.createdAt, params.start));
		}
		if (params.end) {
			conditions.push(lte(occurrences.createdAt, params.end));
		}
		const whereClause = conditions.length === 1 ? conditions[0] : and(...(conditions as [SQL, ...SQL[]]));
		return db.query.occurrences.findMany({
			columns: {
				patientId: true,
				source: true,
				createdAt: true,
			},
			where: whereClause,
		});
	},

	async fetchAlerts(params): Promise<ReportsAlertRow[]> {
		const conditions: SQL[] = [];
		if (params.start) {
			conditions.push(gte(alerts.createdAt, params.start));
		}
		if (params.end) {
			conditions.push(lte(alerts.createdAt, params.end));
		}
		const whereClause =
			conditions.length === 0
				? undefined
				: conditions.length === 1
					? conditions[0]
					: and(...(conditions as [SQL, ...SQL[]]));
		return db.query.alerts.findMany({
			columns: {
				id: true,
				patientId: true,
				kind: true,
				severity: true,
				status: true,
				createdAt: true,
			},
			where: whereClause,
			orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
		});
	},
};
