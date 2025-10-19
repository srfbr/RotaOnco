import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { addMinutes } from "date-fns";
import { createPatientAuthService, type PatientAuthRepository, type PatientSessionPort, type AuditLogPort } from "../patient-auth";

const basePatient = {
	id: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
	fullName: "Paciente Teste",
	cpf: "12345678901",
	birthDate: null,
	phone: null,
	emergencyPhone: null,
	tumorType: null,
	clinicalUnit: null,
	stage: "pre_triage" as const,
	status: "active" as const,
	audioMaterialUrl: null,
	pinAttempts: 0,
	pinBlockedUntil: null,
	pinHash: "hash",
};

describe("createPatientAuthService", () => {
	let repo: PatientAuthRepository;
	let audit: AuditLogPort;
	let sessions: PatientSessionPort;

	beforeEach(() => {
		repo = {
			findByCpf: vi.fn(),
			resetPinState: vi.fn(),
			recordFailedAttempt: vi.fn(),
		};
		audit = {
			record: vi.fn(),
		};
		sessions = {
			create: vi.fn().mockResolvedValue({ token: "token", expiresAt: addMinutes(new Date(), 30) }),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns session data on successful PIN login", async () => {
		(repo.findByCpf as ReturnType<typeof vi.fn>).mockResolvedValue(basePatient);
		vi.spyOn(Bun.password, "verify").mockResolvedValue(true);
		const service = createPatientAuthService({ patients: repo, audit, sessions });

		const result = await service.loginWithPin({ cpf: basePatient.cpf, pin: "123456" });

		expect(result.token).toBe("token");
		expect(result.patient).toEqual(basePatient);
		expect(repo.resetPinState).toHaveBeenCalledWith(basePatient.id);
		expect(audit.record).toHaveBeenCalledWith(
			"PATIENT_SESSION_CREATED",
			basePatient.id,
			expect.objectContaining({ expiresAt: expect.any(String) }),
		);
	});

	it("blocks the patient after three failed attempts", async () => {
		(repo.findByCpf as ReturnType<typeof vi.fn>).mockResolvedValue({
			...basePatient,
			pinAttempts: 2,
		});
		vi.spyOn(Bun.password, "verify").mockResolvedValue(false);
		const service = createPatientAuthService({ patients: repo, audit, sessions });

		await expect(
			service.loginWithPin({ cpf: basePatient.cpf, pin: "000000" }),
		).rejects.toThrowError("PATIENT_PIN_BLOCKED");

		expect(repo.recordFailedAttempt).toHaveBeenCalled();
		expect(audit.record).toHaveBeenCalledWith(
			"PATIENT_PIN_FAILED",
			basePatient.id,
			expect.objectContaining({ attempts: 3 }),
		);
		expect(repo.resetPinState).not.toHaveBeenCalled();
	});
});
