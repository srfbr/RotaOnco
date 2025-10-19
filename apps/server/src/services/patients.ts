import type { InferSelectModel } from "drizzle-orm";
import { appointments, patients } from "../db/schema/core";

export type PatientEntity = InferSelectModel<typeof patients>;
export type AppointmentEntity = InferSelectModel<typeof appointments>;

export interface PatientRepository {
	findById(id: number): Promise<PatientEntity | null>;
	listUpcomingAppointments(patientId: number, limit?: number): Promise<AppointmentEntity[]>;
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
	};
}

export type PatientService = ReturnType<typeof createPatientService>;
