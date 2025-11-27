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

const noopRateLimit: MiddlewareHandler<AppEnv> = async (_c, next) => {
	await next();
};

type RouterSetup = {
	router: ReturnType<typeof createAppRouter>;
	alerts: {
		listAlerts: ReturnType<typeof vi.fn>;
		updateAlert: ReturnType<typeof vi.fn>;
		getAlert: ReturnType<typeof vi.fn>;
	};
	reports: {
		getAttendanceReport: ReturnType<typeof vi.fn>;
		getWaitTimesReport: ReturnType<typeof vi.fn>;
		getAdherenceReport: ReturnType<typeof vi.fn>;
		getAlertsReport: ReturnType<typeof vi.fn>;
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
	const appointments = { confirmAttendance: vi.fn() };
	const alerts = {
		listAlerts: vi.fn(),
		updateAlert: vi.fn(),
		getAlert: vi.fn(),
	};
	const reports = {
		getAttendanceReport: vi.fn(),
		getWaitTimesReport: vi.fn(),
		getAdherenceReport: vi.fn(),
		getAlertsReport: vi.fn(),
	};
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
		appointments: appointments as unknown as AppointmentService,
		alerts: alerts as unknown as AlertService,
		reports: reports as unknown as ReportsService,
		occurrences,
		professionals,
		patientLoginRateLimit: noopRateLimit,
	});

	return {
		router,
		alerts: alerts as {
			listAlerts: ReturnType<typeof vi.fn>;
			updateAlert: ReturnType<typeof vi.fn>;
			getAlert: ReturnType<typeof vi.fn>;
		},
		reports: reports as {
			getAttendanceReport: ReturnType<typeof vi.fn>;
			getWaitTimesReport: ReturnType<typeof vi.fn>;
			getAdherenceReport: ReturnType<typeof vi.fn>;
			getAlertsReport: ReturnType<typeof vi.fn>;
		},
	};
}

describe("alerts routes", () => {
	beforeEach(() => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue({
			user: { id: "ext-user" },
		} as never);
		vi.spyOn(usersRepository, "findUserWithRolesByExternalId").mockResolvedValue({
			id: 88,
			externalId: "ext-user",
			roles: ["professional"],
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lists alerts with filters and metadata", async () => {
		const { router, alerts } = buildRouter();
		const now = new Date();
		alerts.listAlerts.mockResolvedValue({
			data: [
				{
					id: 1,
					patientId: 55,
					kind: "consecutive_absences",
					severity: "high",
					status: "open",
					details: "Paciente faltou três vezes",
					createdAt: now,
					resolvedAt: null,
					resolvedBy: null,
				},
			],
			total: 1,
		});

		const response = await router.request("/alerts?status=open&severity=high&limit=5&offset=10", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(200);
		expect(alerts.listAlerts).toHaveBeenCalledWith({
			professionalId: 88,
			status: "open",
			severity: "high",
			limit: 5,
			offset: 10,
		});
		expect(await response.json()).toEqual({
			data: [
				{
					id: 1,
					patientId: 55,
					kind: "consecutive_absences",
					severity: "high",
					status: "open",
					details: "Paciente faltou três vezes",
					createdAt: now.toISOString(),
					resolvedAt: null,
					resolvedBy: null,
				},
			],
			meta: { total: 1, limit: 5, offset: 10 },
		});
	});

	it("returns validation error when query params are invalid", async () => {
		const { router, alerts } = buildRouter();

		const response = await router.request("/alerts?limit=0", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			code: "VALIDATION_ERROR",
			message: "Payload inválido",
			details: expect.any(Object),
		});
		expect(alerts.listAlerts).not.toHaveBeenCalled();
	});

	it("acknowledges an alert via patch", async () => {
		const { router, alerts } = buildRouter();
		const now = new Date();
		alerts.updateAlert.mockResolvedValue({
			id: 7,
			patientId: 55,
			kind: "risk",
			severity: "high",
			status: "acknowledged",
			details: null,
			createdAt: now,
			resolvedAt: now,
			resolvedBy: 88,
		});

		const response = await router.request("/alerts/7", {
			method: "PATCH",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: "acknowledged" }),
		});

		expect(response.status).toBe(200);
		expect(alerts.updateAlert).toHaveBeenCalledWith(
			7,
			{ status: "acknowledged" },
			{ professionalId: 88 },
		);
		expect(await response.json()).toEqual({
			id: 7,
			patientId: 55,
			kind: "risk",
			severity: "high",
			status: "acknowledged",
			details: null,
			createdAt: now.toISOString(),
			resolvedAt: now.toISOString(),
			resolvedBy: 88,
		});
	});

	it("returns 404 when alert update target is missing", async () => {
		const { router, alerts } = buildRouter();
		alerts.updateAlert.mockResolvedValue(null);

		const response = await router.request("/alerts/99", {
			method: "PATCH",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: "acknowledged" }),
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			code: "NOT_FOUND",
			message: "Alerta não encontrado",
		});
	});
});
