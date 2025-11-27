import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { appointments, patients, users } from "../db/schema/core";
import type { PatientRepository } from "../services/patients";

const UPCOMING_APPOINTMENT_STATUSES = ["scheduled", "confirmed"] as const;

export const patientsRepository: PatientRepository = {
	async findById(id) {
		const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
		return patient ?? null;
	},

	async listUpcomingAppointments(patientId, limit = 3) {
		const now = new Date();
		const rows = await db
			.select({
				appointment: appointments,
				professional: {
					id: users.id,
					name: users.name,
					specialty: users.specialty,
					avatarUrl: users.avatarUrl,
				},
			})
			.from(appointments)
			.leftJoin(users, eq(appointments.professionalId, users.id))
			.where(
				and(
					eq(appointments.patientId, patientId),
					inArray(appointments.status, UPCOMING_APPOINTMENT_STATUSES),
					gte(appointments.startsAt, now),
				),
			)
			.orderBy(asc(appointments.startsAt))
			.limit(limit);
		return rows.map((row) => ({
			...row.appointment,
			professional: row.professional?.id
				? {
					id: row.professional.id,
					name: row.professional.name,
					specialty: row.professional.specialty ?? null,
					avatarUrl: row.professional.avatarUrl ?? null,
				}
				: null,
		}));
	},
};
