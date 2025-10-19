import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { appointments, patients } from "../db/schema/core";
import type { PatientRepository } from "../services/patients";

const UPCOMING_APPOINTMENT_STATUSES = ["scheduled", "confirmed"] as const;

export const patientsRepository: PatientRepository = {
	async findById(id) {
		const patient = await db.query.patients.findFirst({ where: eq(patients.id, id) });
		return patient ?? null;
	},

	async listUpcomingAppointments(patientId, limit = 3) {
		const now = new Date();
		return db.query.appointments.findMany({
			where: and(
				eq(appointments.patientId, patientId),
				inArray(appointments.status, UPCOMING_APPOINTMENT_STATUSES),
				gte(appointments.startsAt, now),
			),
			orderBy: (appt, { asc }) => [asc(appt.startsAt)],
			limit,
		});
	},
};
