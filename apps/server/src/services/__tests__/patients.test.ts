import { describe, expect, it, beforeEach, vi } from "vitest";
import { createPatientService, type PatientRepository } from "../patients";

const patient = {
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
	audioMaterialUrl: "https://example.com/material.mp3",
	pinAttempts: 0,
	pinBlockedUntil: null,
	pinHash: "hash",
};

describe("createPatientService", () => {
	let repo: PatientRepository;

	beforeEach(() => {
		repo = {
			findById: vi.fn().mockResolvedValue(patient),
			listUpcomingAppointments: vi.fn().mockResolvedValue([
				{
					id: 10,
					patientId: 1,
					professionalId: 2,
					startsAt: new Date(Date.now() + 60_000),
					type: "triage" as const,
					status: "scheduled" as const,
					notes: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					professional: {
						id: 2,
						name: "Dra. Ana",
						specialty: "Oncologia",
						avatarUrl: "https://example.com/avatar.png",
					},
				},
			]),
		};
	});

	it("returns patient mobile data", async () => {
		const service = createPatientService(repo);
		const result = await service.getMobileView(1);

		expect(repo.findById).toHaveBeenCalledWith(1);
		expect(result.patient).toEqual(patient);
		expect(result.nextAppointments).toHaveLength(1);
		expect(result.nextAppointments[0].professional).toEqual({
			id: 2,
			name: "Dra. Ana",
			specialty: "Oncologia",
			avatarUrl: "https://example.com/avatar.png",
		});
		expect(result.audioMaterials).toEqual([
			{ title: "Material educativo", url: patient.audioMaterialUrl },
		]);
	});

	it("throws when patient is missing", async () => {
		(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		const service = createPatientService(repo);
		await expect(service.getMobileView(1)).rejects.toThrowError("PATIENT_NOT_FOUND");
	});

	it("lists upcoming appointments with clamped limit", async () => {
		const service = createPatientService(repo);
		await service.listUpcomingAppointments(1, 200);
		expect(repo.listUpcomingAppointments).toHaveBeenCalledWith(1, 50);
		await service.listUpcomingAppointments(1, 0);
		expect(repo.listUpcomingAppointments).toHaveBeenCalledWith(1, 1);
		await service.listUpcomingAppointments(1);
		expect(repo.listUpcomingAppointments).toHaveBeenCalledWith(1, 20);
	});
});
