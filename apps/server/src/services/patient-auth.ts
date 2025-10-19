import { addMinutes } from "date-fns";
import type { InferSelectModel } from "drizzle-orm";
import { patients } from "../db/schema/core";

export type PatientRecord = InferSelectModel<typeof patients>;

export interface PatientAuthRepository {
	findByCpf(cpf: string): Promise<PatientRecord | null>;
	resetPinState(patientId: number): Promise<void>;
	recordFailedAttempt(patientId: number, attempts: number, blockedUntil: Date | null): Promise<void>;
}

export interface AuditLogPort {
	record(action: string, entityId: number, details: Record<string, unknown>): Promise<void>;
}

export interface PatientSessionPort {
	create(patientId: number): Promise<{
		token: string;
		expiresAt: Date;
	}>;
}

export type LoginPatientPinInput = {
	cpf: string;
	pin: string;
	ip?: string | null;
	userAgent?: string | null;
};

export type LoginPatientPinResult = {
	token: string;
	expiresAt: Date;
	patient: PatientRecord;
};

const MAX_ATTEMPTS = 3;
const BLOCK_MINUTES = 15;

export function createPatientAuthService(deps: {
	patients: PatientAuthRepository;
	audit: AuditLogPort;
	sessions: PatientSessionPort;
}) {
	const { patients: patientRepo, audit, sessions } = deps;

	return {
		async loginWithPin(input: LoginPatientPinInput): Promise<LoginPatientPinResult> {
			const { cpf, pin, ip, userAgent } = input;
			const patient = await patientRepo.findByCpf(cpf);
			if (!patient) {
				throw new Error("PATIENT_NOT_FOUND");
			}

			if (patient.pinBlockedUntil && patient.pinBlockedUntil.getTime() > Date.now()) {
				throw new Error("PATIENT_PIN_BLOCKED");
			}

			const isValid = await Bun.password.verify(pin, patient.pinHash);
			if (!isValid) {
				const attempts = patient.pinAttempts + 1;
				const shouldBlock = attempts >= MAX_ATTEMPTS;
				const blockedUntil = shouldBlock ? addMinutes(new Date(), BLOCK_MINUTES) : null;
				await patientRepo.recordFailedAttempt(patient.id, attempts, blockedUntil);
				await audit.record("PATIENT_PIN_FAILED", patient.id, {
					attempts,
					blockedUntil,
					ip,
					userAgent,
				});
				throw new Error(shouldBlock ? "PATIENT_PIN_BLOCKED" : "INVALID_PIN");
			}

			await patientRepo.resetPinState(patient.id);

			const session = await sessions.create(patient.id);

			await audit.record("PATIENT_SESSION_CREATED", patient.id, {
				ip,
				userAgent,
				expiresAt: session.expiresAt.toISOString(),
			});

			return {
				token: session.token,
				expiresAt: session.expiresAt,
				patient,
			};
		},
	};
}

export type PatientAuthService = ReturnType<typeof createPatientAuthService>;
