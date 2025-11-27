import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "..";
import type { PatientAuthService } from "../../services/patient-auth";
import type { PatientService } from "../../services/patients";
import type { PatientManagementService } from "../../services/patient-management";
import type { AppointmentService } from "../../services/appointments";
import type { AlertService } from "../../services/alerts";
import type { ReportsService } from "../../services/reports";
import type { OccurrenceService } from "../../services/occurrences";
import type { ProfessionalOnboardingService } from "../../services/professionals";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../../types/context";
import { auth } from "../../lib/auth";
import * as usersRepository from "../../repositories/users";

const noopRateLimit: MiddlewareHandler<AppEnv> = async (_c, next) => {
	await next();
};

type RouterSetup = {
	router: ReturnType<typeof createAppRouter>;
	patientManagement: {
		listPatients: ReturnType<typeof vi.fn>;
		createPatient: ReturnType<typeof vi.fn>;
		searchPatients: ReturnType<typeof vi.fn>;
		getPatientDetail: ReturnType<typeof vi.fn>;
	};
};

function buildRouter(): RouterSetup {
	const patientAuth = { loginWithPin: vi.fn() } as unknown as PatientAuthService;
	const patients = { getMobileView: vi.fn() } as unknown as PatientService;
	const patientManagement = {
		listPatients: vi.fn(),
		createPatient: vi.fn(),
		searchPatients: vi.fn(),
		getPatientDetail: vi.fn(),
	};
	const appointments = { confirmAttendance: vi.fn() } as unknown as AppointmentService;
	const alerts = { listAlerts: vi.fn(), getAlert: vi.fn(), updateAlert: vi.fn() } as unknown as AlertService;
	const reports = {
		getAttendanceReport: vi.fn(),
		getWaitTimesReport: vi.fn(),
		getAdherenceReport: vi.fn(),
		getAlertsReport: vi.fn(),
	} as unknown as ReportsService;
	const occurrences = {
		listPatientOccurrences: vi.fn(),
		createOccurrence: vi.fn(),
	} as unknown as OccurrenceService;
	const professionals = {
		completeOnboarding: vi.fn(),
	} as unknown as ProfessionalOnboardingService;
	const router = createAppRouter({
		patientAuth,
		patients,
		patientManagement: patientManagement as unknown as PatientManagementService,
		appointments,
		alerts,
		reports,
		occurrences,
		professionals,
		patientLoginRateLimit: noopRateLimit,
	});
	return { router, patientManagement };
}

describe("patients routes", () => {
	beforeEach(() => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue({
			user: { id: "ext-user" },
		} as never);
		vi.spyOn(usersRepository, "findUserWithRolesByExternalId").mockResolvedValue({
			id: 99,
			externalId: "ext-user",
			roles: ["professional"],
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lists patients with pagination metadata", async () => {
		const { router, patientManagement } = buildRouter();
		patientManagement.listPatients.mockResolvedValue({
			data: [
				{ id: 1, fullName: "Ana", cpf: "12345678901", stage: "pre_triage", status: "active" },
			],
			total: 1,
		});

		const response = await router.request("/patients?q=Ana&limit=10&offset=5", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(patientManagement.listPatients).toHaveBeenCalledWith({
			q: "Ana",
			limit: 10,
			offset: 5,
		});
		expect(payload).toEqual({
			data: [
				{ id: 1, fullName: "Ana", cpf: "12345678901", stage: "pre_triage", status: "active" },
			],
			meta: { total: 1, limit: 10, offset: 5 },
		});
	});

	it("searches patients", async () => {
		const { router, patientManagement } = buildRouter();
		patientManagement.searchPatients.mockResolvedValue([
			{ id: 2, fullName: "Bruno", cpf: "22222222222", stage: "in_treatment", status: "active" },
		]);

		const response = await router.request("/patients/search?q=bru&limit=5", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(200);
		expect(patientManagement.searchPatients).toHaveBeenCalledWith("bru", 5);
		const payload = await response.json();
		expect(payload).toEqual([
			{ id: 2, fullName: "Bruno", cpf: "22222222222", stage: "in_treatment", status: "active" },
		]);
	});

	it("creates a patient and returns 201", async () => {
		const { router, patientManagement } = buildRouter();
		const now = new Date();
		patientManagement.createPatient.mockResolvedValue({
			id: 1,
			fullName: "Ana",
			cpf: "12345678901",
			birthDate: null,
			phone: null,
			emergencyPhone: null,
			tumorType: null,
			clinicalUnit: null,
			stage: "pre_triage",
			status: "active",
			audioMaterialUrl: null,
			pinAttempts: 0,
			pinBlockedUntil: null,
			pinHash: "hash",
			createdAt: now,
			updatedAt: now,
		});

		const response = await router.request("/patients", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				fullName: " Ana ",
				cpf: "12345678901",
				pin: "1234",
				phone: "",
				contacts: [
					{ fullName: "Contato", relation: "Mãe", phone: "119999", isPrimary: true },
				],
			}),
		});

		expect(response.status).toBe(201);
		expect(response.headers.get("location")).toBe("/patients/1");
		expect(patientManagement.createPatient).toHaveBeenCalledWith(
			expect.objectContaining({
				fullName: " Ana ".trim(),
				phone: null,
			}),
			expect.objectContaining({ professionalId: 99 }),
		);
		const payload = await response.json();
		expect(payload.id).toBe(1);
	});

	it("returns patient detail", async () => {
		const { router, patientManagement } = buildRouter();
		patientManagement.getPatientDetail.mockResolvedValue({
			patient: {
				id: 1,
				fullName: "Ana",
				cpf: "12345678901",
				birthDate: null,
				phone: null,
				emergencyPhone: null,
				tumorType: null,
				clinicalUnit: null,
				stage: "pre_triage",
				status: "active",
				audioMaterialUrl: null,
				pinAttempts: 0,
				pinBlockedUntil: null,
				pinHash: "hash",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			contacts: [],
			occurrences: [],
			alerts: [],
		});

		const response = await router.request("/patients/1", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(200);
		expect(patientManagement.getPatientDetail).toHaveBeenCalledWith(1);
		const payload = await response.json();
		expect(payload).toMatchObject({ patient: { id: 1 } });
	});

	it("returns 404 when patient detail missing", async () => {
		const { router, patientManagement } = buildRouter();
		patientManagement.getPatientDetail.mockResolvedValue(null);

		const response = await router.request("/patients/999", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(404);
		const payload = await response.json();
		expect(payload).toEqual({ code: "NOT_FOUND", message: "Paciente não encontrado" });
	});

	it("maps duplicate CPF error to 409", async () => {
		const { router, patientManagement } = buildRouter();
		patientManagement.createPatient.mockRejectedValue(new Error("PATIENT_DUPLICATE"));

		const response = await router.request("/patients", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ fullName: "Ana", cpf: "12345678901", pin: "1234" }),
		});

		expect(response.status).toBe(409);
		const payload = await response.json();
		expect(payload).toEqual({
			code: "UNIQUE_CONSTRAINT",
			message: "Paciente com este CPF já está cadastrado.",
		});
	});
});
