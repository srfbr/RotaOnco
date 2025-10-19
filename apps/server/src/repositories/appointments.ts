import { and, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
	appointmentReminders,
	appointments,
	patients,
	users,
} from "../db/schema/core";
import type {
	AppointmentCreateInput,
	AppointmentDetailRecord,
	AppointmentListParams,
	AppointmentListResult,
	AppointmentRepository,
	AppointmentUpdateInput,
} from "../services/appointments";

const DEFAULT_LIMIT = 20;

function clampLimit(limit?: number) {
	if (!limit) return DEFAULT_LIMIT;
	return Math.max(1, Math.min(limit, 100));
}

async function fetchById(id: number) {
	const appointment = await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
	return appointment ?? null;
}

async function fetchDetail(id: number): Promise<AppointmentDetailRecord | null> {
	const appointment = await fetchById(id);
	if (!appointment) {
		return null;
	}
	const [patientRow, professionalRow, reminders] = await Promise.all([
		db.query.patients.findFirst({
			columns: {
				id: true,
				fullName: true,
				cpf: true,
				stage: true,
				status: true,
			},
			where: eq(patients.id, appointment.patientId),
		}),
		db.query.users.findFirst({
			columns: {
				id: true,
				name: true,
				email: true,
				specialty: true,
			},
			where: eq(users.id, appointment.professionalId),
		}),
		db.query.appointmentReminders.findMany({
			where: eq(appointmentReminders.appointmentId, appointment.id),
			orderBy: (table, { desc: orderDesc }) => [orderDesc(table.scheduledFor)],
		}),
	]);

	return {
		appointment,
		patient: patientRow ?? null,
		professional: professionalRow ?? null,
		reminders,
	};
}

export const appointmentsRepository: AppointmentRepository = {
	async findById(id) {
		return fetchById(id);
	},

	async listAppointments({ start, end, patientId, professionalId, status, limit, offset }: AppointmentListParams): Promise<AppointmentListResult> {
		const conditions: SQL[] = [];
		if (patientId) {
			conditions.push(eq(appointments.patientId, patientId));
		}
		if (professionalId) {
			conditions.push(eq(appointments.professionalId, professionalId));
		}
		if (status) {
			conditions.push(eq(appointments.status, status));
		}
		if (start) {
			conditions.push(gte(appointments.startsAt, start));
		}
		if (end) {
			conditions.push(lte(appointments.startsAt, end));
		}
		const whereClause =
			conditions.length > 0 ? and(...(conditions as [SQL, ...SQL[]])) : undefined;
		const cappedLimit = clampLimit(limit);
		const currentOffset = offset ?? 0;
		const rows = await db.query.appointments.findMany({
			where: whereClause,
			orderBy: (table, { desc }) => [desc(table.startsAt)],
			limit: cappedLimit,
			offset: currentOffset,
		});
		const countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(appointments);
		const countRows = whereClause ? await countQuery.where(whereClause) : await countQuery;
		return {
			data: rows,
			total: countRows[0]?.count ?? 0,
		};
	},

	async createAppointment(input: AppointmentCreateInput) {
		const now = new Date();
		const result = await db.insert(appointments).values({
			patientId: input.patientId,
			professionalId: input.professionalId,
			startsAt: input.startsAt,
			type: input.type,
			notes: input.notes ?? null,
			createdAt: now,
			updatedAt: now,
		});
		const insertId = Number((result as { insertId?: number }).insertId);
		if (!insertId || Number.isNaN(insertId)) {
			throw new Error("APPOINTMENT_CREATE_FAILED");
		}
		const created = await fetchById(insertId);
		if (!created) {
			throw new Error("APPOINTMENT_CREATE_FAILED");
		}
		return created;
	},

	async updateAppointment(id: number, input: AppointmentUpdateInput) {
		const update: Partial<typeof appointments.$inferSelect> = {
			updatedAt: new Date(),
		};
		if (input.startsAt) {
			update.startsAt = input.startsAt;
		}
		if (input.type) {
			update.type = input.type;
		}
		if (input.notes !== undefined) {
			update.notes = input.notes;
		}
		await db.update(appointments).set(update).where(eq(appointments.id, id));
		return fetchById(id);
	},

	async findDetailById(id: number) {
		return fetchDetail(id);
	},

	async updateStatus(id, status, notes) {
		const update: Partial<typeof appointments.$inferSelect> = {
			status,
			updatedAt: new Date(),
		};
		if (notes !== undefined) {
			update.notes = notes;
		}
		await db.update(appointments).set(update).where(eq(appointments.id, id));
	},

	async hasConflict({ professionalId, startsAt, excludeId }) {
		const conditions: SQL[] = [
			eq(appointments.professionalId, professionalId),
			eq(appointments.startsAt, startsAt),
			ne(appointments.status, "canceled"),
		];
		if (excludeId) {
			conditions.push(ne(appointments.id, excludeId));
		}
		const conflict = await db.query.appointments.findFirst({
			where: and(...(conditions as [SQL, ...SQL[]])),
		});
		return Boolean(conflict);
	},
};
