import type { InferSelectModel } from "drizzle-orm";
import { appointments, patients } from "../db/schema/core";

export type PatientEntity = InferSelectModel<typeof patients>;
export type AppointmentEntity = InferSelectModel<typeof appointments>;

export type AppointmentProfessional = {
	id: number;
	name: string;
	specialty: string | null;
	avatarUrl: string | null;
};

export type UpcomingAppointment = AppointmentEntity & {
	professional: AppointmentProfessional | null;
};

function clampLimit(limit?: number | null) {
	const fallback = 20;
	if (typeof limit !== "number" || Number.isNaN(limit)) {
		return fallback;
	}
	const normalized = Math.trunc(limit);
	if (normalized <= 0) {
		return 1;
	}
	if (normalized > 50) {
		return 50;
	}
	return normalized;
}

export interface PatientRepository {
	findById(id: number): Promise<PatientEntity | null>;
	listUpcomingAppointments(
		patientId: number,
		limit?: number,
	): Promise<UpcomingAppointment[]>;
}

export function createPatientService(repo: PatientRepository) {
	return {
		async getMobileView(patientId: number) {
			const patient = await repo.findById(patientId);
			if (!patient) {
				throw new Error("PATIENT_NOT_FOUND");
			}
			const nextAppointments = await repo.listUpcomingAppointments(patientId, 3);
			const audioMaterials = patient.audioMaterialUrl
				? [
					{
						title: "Material educativo",
						url: patient.audioMaterialUrl,
					},
				]
				: [];

			return {
				patient,
				nextAppointments,
				audioMaterials,
			};
		},

		async listUpcomingAppointments(patientId: number, limit?: number) {
			const normalizedLimit = clampLimit(limit);
			return repo.listUpcomingAppointments(patientId, normalizedLimit);
		},
	};
}

export type PatientService = ReturnType<typeof createPatientService>;
