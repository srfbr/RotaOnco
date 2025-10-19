import { eq } from "drizzle-orm";
import { db } from "../db";
import { patients } from "../db/schema/core";
import type { PatientAuthRepository } from "../services/patient-auth";

export const patientAuthRepository: PatientAuthRepository = {
	async findByCpf(cpf) {
		const patient = await db.query.patients.findFirst({ where: eq(patients.cpf, cpf) });
		return patient ?? null;
	},

	async resetPinState(patientId) {
		await db
			.update(patients)
			.set({
				pinAttempts: 0,
				pinBlockedUntil: null,
				updatedAt: new Date(),
			})
			.where(eq(patients.id, patientId));
	},

	async recordFailedAttempt(patientId, attempts, blockedUntil) {
		await db
			.update(patients)
			.set({
				pinAttempts: attempts,
				pinBlockedUntil: blockedUntil,
				updatedAt: new Date(),
			})
			.where(eq(patients.id, patientId));
	},
};
