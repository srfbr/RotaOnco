import type { InferSelectModel } from "drizzle-orm";
import { appointmentReminders, appointments, patients, users } from "../db/schema/core";

export type AppointmentEntity = InferSelectModel<typeof appointments>;
export type AppointmentReminderEntity = InferSelectModel<typeof appointmentReminders>;
type PatientRow = InferSelectModel<typeof patients>;
type UserRow = InferSelectModel<typeof users>;

export type AppointmentListParams = {
	start?: Date;
	end?: Date;
	patientId?: number;
	professionalId?: number;
	status?: AppointmentEntity["status"];
	limit?: number;
	offset?: number;
};

export type AppointmentListResult = {
	data: AppointmentEntity[];
	total: number;
};

export type AppointmentCreateInput = {
	patientId: number;
	professionalId: number;
	startsAt: Date;
	type: AppointmentEntity["type"];
	notes?: string | null;
};

export type AppointmentUpdateInput = {
	startsAt?: Date;
	type?: AppointmentEntity["type"];
	notes?: string | null;
};

export type AppointmentDetailRecord = {
	appointment: AppointmentEntity;
	patient: Pick<PatientRow, "id" | "fullName" | "cpf" | "stage" | "status">
		| null;
	professional: Pick<UserRow, "id" | "name" | "email" | "specialty"> | null;
	reminders: AppointmentReminderEntity[];
};

export interface AppointmentRepository {
	findById(id: number): Promise<AppointmentEntity | null>;
	listAppointments(params: AppointmentListParams): Promise<AppointmentListResult>;
	createAppointment(input: AppointmentCreateInput): Promise<AppointmentEntity>;
	updateAppointment(id: number, input: AppointmentUpdateInput): Promise<AppointmentEntity | null>;
	findDetailById(id: number): Promise<AppointmentDetailRecord | null>;
	updateStatus(id: number, status: AppointmentEntity["status"], notes?: string | null): Promise<void>;
	hasConflict(input: { professionalId: number; startsAt: Date; excludeId?: number }): Promise<boolean>;
}

export interface AuditPort {
	record(action: string, entityId: number, details: Record<string, unknown>): Promise<void>;
}

function clampLimit(limit?: number) {
	if (!limit) return undefined;
	return Math.max(1, Math.min(limit, 100));
}

function normalizeNotes(value?: string | null) {
	if (value === undefined || value === null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function createAppointmentService(deps: {
	appointments: AppointmentRepository;
	audit: AuditPort;
}) {
	const { appointments: repo, audit } = deps;

	return {
		async listAppointments(params: AppointmentListParams) {
			const limit = clampLimit(params.limit);
			const offset = params.offset ?? 0;
			return repo.listAppointments({ ...params, limit, offset });
		},

		async createAppointment(input: AppointmentCreateInput, context: { professionalId: number }) {
			const normalizedNotes = normalizeNotes(input.notes);
			const hasConflict = await repo.hasConflict({
				professionalId: input.professionalId,
				excludeId: undefined,
				startsAt: input.startsAt,
			});
			if (hasConflict) {
				throw new Error("APPOINTMENT_CONFLICT");
			}
			const appointment = await repo.createAppointment({ ...input, notes: normalizedNotes });
			await audit.record("APPOINTMENT_CREATED", appointment.id, {
				patientId: appointment.patientId,
				professionalId: context.professionalId,
				startsAt: appointment.startsAt.toISOString(),
				type: appointment.type,
			});
			return appointment;
		},

		async getAppointmentDetail(id: number) {
			return repo.findDetailById(id);
		},

		async updateAppointment(
			id: number,
			input: AppointmentUpdateInput,
			context: { professionalId: number },
		) {
			const existing = await repo.findById(id);
			if (!existing) {
				throw new Error("APPOINTMENT_NOT_FOUND");
			}
			const update: AppointmentUpdateInput = {};
			if (input.startsAt) {
				update.startsAt = input.startsAt;
			}
			if (input.type) {
				update.type = input.type;
			}
			if (input.notes !== undefined) {
				update.notes = normalizeNotes(input.notes);
			}
			if (!update.startsAt && !update.type && update.notes === undefined) {
				return existing;
			}
			if (update.startsAt) {
				const hasConflict = await repo.hasConflict({
					professionalId: existing.professionalId,
					excludeId: id,
					startsAt: update.startsAt,
				});
				if (hasConflict) {
					throw new Error("APPOINTMENT_CONFLICT");
				}
			}
			const updated = await repo.updateAppointment(id, update);
			if (!updated) {
				throw new Error("APPOINTMENT_NOT_FOUND");
			}
			await audit.record("APPOINTMENT_UPDATED", id, {
				professionalId: context.professionalId,
				patientId: existing.patientId,
				changes: Object.keys(update),
			});
			return updated;
		},

		async cancelAppointment(
			id: number,
			context: { professionalId: number; reason?: string | null },
		) {
			const existing = await repo.findById(id);
			if (!existing) {
				throw new Error("APPOINTMENT_NOT_FOUND");
			}
			const notes = context.reason !== undefined ? normalizeNotes(context.reason) : null;
			await repo.updateStatus(id, "canceled", notes ?? existing.notes ?? null);
			await audit.record("APPOINTMENT_CANCELED", id, {
				professionalId: context.professionalId,
				patientId: existing.patientId,
				reason: notes,
			});
		},

		async updateAppointmentStatus(
			id: number,
			status: AppointmentEntity["status"],
			context: { professionalId: number; notes?: string | null },
		) {
			const existing = await repo.findById(id);
			if (!existing) {
				throw new Error("APPOINTMENT_NOT_FOUND");
			}
			const notes = context.notes !== undefined ? normalizeNotes(context.notes) : undefined;
			await repo.updateStatus(id, status, notes ?? existing.notes ?? null);
			await audit.record("APPOINTMENT_STATUS_UPDATED", id, {
				professionalId: context.professionalId,
				patientId: existing.patientId,
				status,
			});
		},

		async declineAppointment(id: number, patientId: number, reason?: string | null) {
			const appointment = await repo.findById(id);
			if (!appointment || appointment.patientId !== patientId) {
				throw new Error("APPOINTMENT_NOT_FOUND");
			}
			const notes = reason !== undefined ? normalizeNotes(reason) : null;
			await repo.updateStatus(id, "no_show", notes ?? appointment.notes ?? null);
			await audit.record("APPOINTMENT_DECLINED", id, {
				patientId,
				professionalId: appointment.professionalId,
				reason: notes,
			});
		},

		async confirmAttendance(appointmentId: number, patientId: number) {
			const appointment = await repo.findById(appointmentId);
			if (!appointment || appointment.patientId !== patientId) {
				throw new Error("APPOINTMENT_NOT_FOUND");
			}

			if (appointment.status === "confirmed" || appointment.status === "completed") {
				return appointment.status;
			}

			await repo.updateStatus(appointmentId, "confirmed");
			await audit.record("APPOINTMENT_CONFIRMED", appointmentId, {
				patientId,
			});
			return "confirmed" as const;
		},
	};
}

export type AppointmentService = ReturnType<typeof createAppointmentService>;
