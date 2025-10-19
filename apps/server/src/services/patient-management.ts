import type { InferSelectModel } from "drizzle-orm";
import { alerts, occurrences, patientContacts, patients } from "../db/schema/core";

export type PatientEntity = InferSelectModel<typeof patients>;

export type PatientSummary = Pick<PatientEntity, "id" | "fullName" | "cpf" | "stage" | "status">;
export type PatientContactEntity = InferSelectModel<typeof patientContacts>;
export type OccurrenceEntity = InferSelectModel<typeof occurrences>;
export type AlertEntity = InferSelectModel<typeof alerts>;

export type PatientListParams = {
	q?: string;
	status?: PatientEntity["status"];
	stage?: PatientEntity["stage"];
	limit?: number;
	offset?: number;
};

export type PatientListResult = {
	data: PatientSummary[];
	total: number;
};

export type PatientContactInput = {
	fullName: string;
	relation: string;
	phone: string;
	isPrimary?: boolean;
};

export type PatientCreateInput = {
	fullName: string;
	cpf: string;
	pin: string;
	birthDate?: Date | null;
	phone?: string | null;
	emergencyPhone?: string | null;
	tumorType?: string | null;
	clinicalUnit?: string | null;
	stage?: PatientEntity["stage"];
	status?: PatientEntity["status"];
	audioMaterialUrl?: string | null;
	contacts?: PatientContactInput[];
};

export interface PatientManagementRepository {
	listPatients(params: PatientListParams): Promise<PatientListResult>;
	createPatient(input: {
		fullName: string;
		cpf: string;
		pinHash: string;
		birthDate?: Date | null;
		phone?: string | null;
		emergencyPhone?: string | null;
		tumorType?: string | null;
		clinicalUnit?: string | null;
		stage?: PatientEntity["stage"];
		status?: PatientEntity["status"];
		audioMaterialUrl?: string | null;
		contacts?: PatientContactInput[];
	}): Promise<PatientEntity>;
	searchPatients(query: string, limit?: number): Promise<PatientSummary[]>;
	getPatientDetail(id: number): Promise<{
		patient: PatientEntity;
		contacts: PatientContactEntity[];
		occurrences: OccurrenceEntity[];
		alerts: AlertEntity[];
	} | null>;
}

export interface AuditPort {
	record(action: string, entityId: number, details: Record<string, unknown>): Promise<void>;
}

export function createPatientManagementService(deps: {
	repository: PatientManagementRepository;
	audit: AuditPort;
}) {
	const { repository, audit } = deps;

	return {
		async listPatients(params: PatientListParams) {
			const clampedParams: PatientListParams = {
				...params,
				limit: params.limit && params.limit > 0 ? Math.min(params.limit, 100) : params.limit,
			};
			return repository.listPatients(clampedParams);
		},

		async searchPatients(query: string, limit?: number) {
			const trimmed = query.trim();
			if (trimmed.length === 0) {
				return [];
			}
			const cappedLimit = limit && limit > 0 ? Math.min(limit, 100) : undefined;
			return repository.searchPatients(trimmed, cappedLimit);
		},

		async getPatientDetail(id: number) {
			return repository.getPatientDetail(id);
		},

		async createPatient(input: PatientCreateInput, context: { professionalId: number }) {
			const pinHash = await Bun.password.hash(input.pin, {
				algorithm: "argon2id",
			});
			try {
				const patient = await repository.createPatient({
					fullName: input.fullName,
					cpf: input.cpf,
					pinHash,
					birthDate: input.birthDate ?? null,
					phone: input.phone ?? null,
					emergencyPhone: input.emergencyPhone ?? null,
					tumorType: input.tumorType ?? null,
					clinicalUnit: input.clinicalUnit ?? null,
					stage: input.stage,
					status: input.status,
					audioMaterialUrl: input.audioMaterialUrl ?? null,
					contacts: input.contacts,
				});

				await audit.record("PATIENT_CREATED", patient.id, {
					professionalId: context.professionalId,
					cpf: patient.cpf,
				});

				return patient;
			} catch (error) {
				if (error instanceof Error) {
					// MySQL duplicate entry
					if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
						throw new Error("PATIENT_DUPLICATE");
					}
				}
				throw error;
			}
		},
	};
}

export type PatientManagementService = ReturnType<typeof createPatientManagementService>;
