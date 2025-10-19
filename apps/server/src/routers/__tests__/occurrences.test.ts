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
import type { AppEnv } from "../../types/context";
import { auth } from "../../lib/auth";
import * as usersRepository from "../../repositories/users";

const noopRateLimit: MiddlewareHandler<AppEnv> = async (_c, next) => {
	await next();
};

type RouterSetup = {
	router: ReturnType<typeof createAppRouter>;
	occurrences: {
		listPatientOccurrences: ReturnType<typeof vi.fn>;
		createOccurrence: ReturnType<typeof vi.fn>;
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
	} as unknown as PatientManagementService;
	const appointments = { confirmAttendance: vi.fn() } as unknown as AppointmentService;
	const alerts = { listAlerts: vi.fn(), getAlert: vi.fn(), updateAlert: vi.fn() } as unknown as AlertService;
	const reports = {
		getAttendanceReport: vi.fn(),
		getWaitTimesReport: vi.fn(),
	} as unknown as ReportsService;
	const occurrences = {
		listPatientOccurrences: vi.fn(),
		createOccurrence: vi.fn(),
	} as unknown as OccurrenceService;

	const router = createAppRouter({
		patientAuth,
		patients,
		patientManagement,
		appointments,
		alerts,
		reports,
		occurrences,
		patientLoginRateLimit: noopRateLimit,
	});

	return {
		router,
		occurrences: occurrences as {
			listPatientOccurrences: ReturnType<typeof vi.fn>;
			createOccurrence: ReturnType<typeof vi.fn>;
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
	});

	afterEach(() => {
		vi.restoreAllMocks();
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
});
