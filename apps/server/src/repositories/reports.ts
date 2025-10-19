import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../db";
import { appointments } from "../db/schema/core";
import type {
	AttendanceReportInput,
	ReportsAppointmentRow,
	ReportsRepository,
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
			},
			where: whereClause,
		});
	},
};
