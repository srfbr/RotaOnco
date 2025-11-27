import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPatientManagementService, type PatientManagementRepository, type AuditPort } from "../patient-management";

const basePatient = {
	id: 1,
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
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("createPatientManagementService", () => {
	let repository: PatientManagementRepository;
	let audit: AuditPort;

	beforeEach(() => {
		repository = {
			listPatients: vi.fn().mockResolvedValue({ data: [], total: 0 }),
			createPatient: vi.fn().mockResolvedValue(basePatient),
			searchPatients: vi.fn().mockResolvedValue([]),
			getPatientDetail: vi.fn().mockResolvedValue(null),
			updatePatient: vi.fn().mockResolvedValue(basePatient),
		};
		audit = {
			record: vi.fn(),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("hashes PIN and creates patient", async () => {
		const hashSpy = vi.spyOn(Bun.password, "hash").mockResolvedValue("hashed" as never);
		const service = createPatientManagementService({ repository, audit });

		const patient = await service.createPatient(
			{ fullName: basePatient.fullName, cpf: basePatient.cpf, pin: "1234" },
			{ professionalId: 42 },
		);

		expect(hashSpy).toHaveBeenCalledWith("1234", { algorithm: "argon2id" });
		expect(repository.createPatient).toHaveBeenCalledWith(
			expect.objectContaining({ pinHash: "hashed" }),
		);
		expect(patient).toEqual(basePatient);
		expect(audit.record).toHaveBeenCalledWith(
			"PATIENT_CREATED",
			basePatient.id,
			expect.objectContaining({ professionalId: 42, cpf: basePatient.cpf }),
		);
	});

	it("maps duplicate CPF error", async () => {
		const dupError = new Error("duplicate");
		(dupError as { code?: string }).code = "ER_DUP_ENTRY";
		(repository.createPatient as ReturnType<typeof vi.fn>).mockRejectedValueOnce(dupError);
		const service = createPatientManagementService({ repository, audit });

		await expect(
			service.createPatient(
				{ fullName: basePatient.fullName, cpf: basePatient.cpf, pin: "1234" },
				{ professionalId: 42 },
			),
		).rejects.toThrowError("PATIENT_DUPLICATE");
	});

	it("delegates listPatients", async () => {
		const service = createPatientManagementService({ repository, audit });
		await service.listPatients({ q: "Ana" });
		expect(repository.listPatients).toHaveBeenCalledWith({ q: "Ana" });
	});
});
