import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MiddlewareHandler } from "hono";
import { createAppRouter } from "..";
import type { PatientAuthService } from "../../services/patient-auth";
import type { PatientService } from "../../services/patients";
import type { PatientManagementService } from "../../services/patient-management";
import type { AppointmentService } from "../../services/appointments";
import type { AlertService } from "../../services/alerts";
import type { ReportsService } from "../../services/reports";
import type { OccurrenceService } from "../../services/occurrences";
import type { ProfessionalOnboardingService } from "../../services/professionals";
import type { AppEnv } from "../../types/context";
import { auth } from "../../lib/auth";
import * as usersRepository from "../../repositories/users";
import * as patientSession from "../../lib/patient-session";

const noopRateLimit: MiddlewareHandler<AppEnv> = async (_c, next) => {
	await next();
};

type RouterSetup = {
	router: ReturnType<typeof createAppRouter>;
	occurrences: {
		listPatientOccurrences: ReturnType<typeof vi.fn>;
		createOccurrence: ReturnType<typeof vi.fn>;
	};
	patients: {
		getMobileView: ReturnType<typeof vi.fn>;
		listUpcomingAppointments: ReturnType<typeof vi.fn>;
	};
};

function buildRouter(): RouterSetup {
	const patientAuth = { loginWithPin: vi.fn() } as unknown as PatientAuthService;
	const patients = {
		getMobileView: vi.fn(),
		listUpcomingAppointments: vi.fn(),
	};
	const patientManagement = {
		listPatients: vi.fn(),
		createPatient: vi.fn(),
		searchPatients: vi.fn(),
		getPatientDetail: vi.fn(),
	} as unknown as PatientManagementService;
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
	};
	const professionals = {
		completeOnboarding: vi.fn(),
	} as unknown as ProfessionalOnboardingService;

	const router = createAppRouter({
		patientAuth,
		patients: patients as unknown as PatientService,
		patientManagement,
		appointments,
		alerts,
		reports,
		occurrences: occurrences as unknown as OccurrenceService,
		professionals,
		patientLoginRateLimit: noopRateLimit,
	});

	return {
		router,
		occurrences: occurrences as {
			listPatientOccurrences: ReturnType<typeof vi.fn>;
			createOccurrence: ReturnType<typeof vi.fn>;
		},
		patients: patients as {
			getMobileView: ReturnType<typeof vi.fn>;
			listUpcomingAppointments: ReturnType<typeof vi.fn>;
		},
	};
}

describe("occurrences routes", () => {
	beforeEach(() => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue({
			user: { id: "ext-user" },
		} as never);
		vi.spyOn(usersRepository, "findUserWithRolesByExternalId").mockResolvedValue({
			id: 101,
			externalId: "ext-user",
			roles: ["professional"],
		});
		vi.spyOn(patientSession, "verifyPatientSession").mockResolvedValue({
			patientId: 55,
			sessionId: "session-1",
			expiresAt: new Date(Date.now() + 60_000),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.PATIENT_OCCURRENCE_FALLBACK_PROFESSIONAL_ID;
	});

	it("lists occurrences for patient", async () => {
		const { router, occurrences } = buildRouter();
		const createdAt = new Date();
		occurrences.listPatientOccurrences.mockResolvedValue([
			{
				id: 1,
				patientId: 55,
				professionalId: 101,
				kind: "dor",
				intensity: 7,
				source: "professional",
				notes: "Paciente relatou dor",
				createdAt,
			},
		]);

		const response = await router.request("/patients/55/occurrences", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(200);
		expect(occurrences.listPatientOccurrences).toHaveBeenCalledWith(55);
		expect(await response.json()).toHaveLength(1);
	});

	it("creates occurrence for patient", async () => {
		const { router, occurrences } = buildRouter();
		const now = new Date();
		occurrences.createOccurrence.mockResolvedValue({
			id: 10,
			patientId: 55,
			professionalId: 101,
			kind: "dor",
			intensity: 8,
			source: "professional",
			notes: "Paciente relatou dor",
			createdAt: now,
		});

		const response = await router.request("/patients/55/occurrences", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				kind: " dor ",
				intensity: 8,
				source: "professional",
				notes: "Paciente relatou dor",
			}),
		});

		expect(response.status).toBe(201);
		expect(occurrences.createOccurrence).toHaveBeenCalledWith(
			55,
			expect.objectContaining({ kind: "dor", intensity: 8, source: "professional" }),
			expect.objectContaining({ professionalId: 101 }),
		);
		const payload = await response.json();
		expect(payload).toMatchObject({ id: 10, patientId: 55 });
	});

	it("returns validation error when body invalid", async () => {
		const { router, occurrences } = buildRouter();

		const response = await router.request("/patients/55/occurrences", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ intensity: -1 }),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			code: "VALIDATION_ERROR",
			message: "Payload inválido",
			details: expect.any(Object),
		});
		expect(occurrences.createOccurrence).not.toHaveBeenCalled();
	});

	it("validates patient id param", async () => {
		const { router, occurrences } = buildRouter();

		const response = await router.request("/patients/foo/occurrences", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			code: "VALIDATION_ERROR",
			message: "Payload inválido",
			details: { id: "ID inválido" },
		});
		expect(occurrences.listPatientOccurrences).not.toHaveBeenCalled();
	});

	it("allows authenticated patient to report occurrence", async () => {
		const { router, occurrences, patients } = buildRouter();
		const now = new Date();
		const professionalId = 777;
		patients.listUpcomingAppointments.mockResolvedValue([
			{
				id: 1,
				patientId: 55,
				professionalId,
				startsAt: now,
				type: "triage",
				status: "scheduled",
				notes: null,
				createdAt: now,
				updatedAt: now,
				professional: {
					id: professionalId,
					name: "Dra. Silva",
					specialty: null,
					avatarUrl: null,
				},
			},
		]);
		occurrences.createOccurrence.mockResolvedValue({
			id: 99,
			patientId: 55,
			professionalId,
			kind: "Nausea",
			intensity: 6,
			source: "patient",
			notes: null,
			createdAt: now,
		});

		const response = await router.request("/patients/me/occurrences", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: "patient_session=fake-token",
			},
			body: JSON.stringify({ kind: "Nausea", intensity: 6 }),
		});

		expect(response.status).toBe(201);
		expect(occurrences.createOccurrence).toHaveBeenCalledWith(
			55,
			expect.objectContaining({ kind: "Nausea", intensity: 6, source: "patient" }),
			{ professionalId },
		);
		const payload = await response.json();
		expect(payload).toMatchObject({ id: 99, source: "patient" });
	});

	it("falls back to configured professional when no upcoming appointment", async () => {
		const { router, occurrences, patients } = buildRouter();
		patients.listUpcomingAppointments.mockResolvedValue([]);
		const fallbackId = 321;
		process.env.PATIENT_OCCURRENCE_FALLBACK_PROFESSIONAL_ID = String(fallbackId);
		const now = new Date();
		occurrences.createOccurrence.mockResolvedValue({
			id: 10,
			patientId: 55,
			professionalId: fallbackId,
			kind: "Cansaço",
			intensity: 4,
			source: "patient",
			notes: null,
			createdAt: now,
		});

		const response = await router.request("/patients/me/occurrences", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: "patient_session=fake-token",
			},
			body: JSON.stringify({ kind: "Cansaço", intensity: 4 }),
		});

		expect(response.status).toBe(201);
		expect(occurrences.createOccurrence).toHaveBeenCalledWith(
			55,
			expect.objectContaining({ source: "patient" }),
			{ professionalId: fallbackId },
		);
	});

	it("returns 409 when no professional can be resolved", async () => {
		const { router, occurrences, patients } = buildRouter();
		patients.listUpcomingAppointments.mockResolvedValue([]);

		const response = await router.request("/patients/me/occurrences", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: "patient_session=fake-token",
			},
			body: JSON.stringify({ kind: "Dor", intensity: 3 }),
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			code: "PROFESSIONAL_NOT_FOUND",
			message: "Não foi possível identificar um profissional responsável para este paciente.",
		});
		expect(occurrences.createOccurrence).not.toHaveBeenCalled();
	});
});
