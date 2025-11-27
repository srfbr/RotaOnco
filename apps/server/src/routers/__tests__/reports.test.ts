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
	} as unknown as PatientManagementService;
	const appointments = {
		confirmAttendance: vi.fn(),
		declineAppointment: vi.fn(),
		listAppointments: vi.fn(),
		createAppointment: vi.fn(),
		getAppointmentDetail: vi.fn(),
		updateAppointment: vi.fn(),
		cancelAppointment: vi.fn(),
		updateAppointmentStatus: vi.fn(),
	} as unknown as AppointmentService;
	const alerts = {
		listAlerts: vi.fn(),
		getAlert: vi.fn(),
		updateAlert: vi.fn(),
	} as unknown as AlertService;
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
		patientManagement,
		appointments,
		alerts,
		reports: reports as unknown as ReportsService,
		occurrences,
		professionals,
		patientLoginRateLimit: noopRateLimit,
	});

	return {
		router,
		reports,
	};
}

describe("reports routes", () => {
	beforeEach(() => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue({
			user: { id: "ext-user" },
		} as never);
		vi.spyOn(usersRepository, "findUserWithRolesByExternalId").mockResolvedValue({
			id: 77,
			externalId: "ext-user",
			roles: ["professional"],
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns attendance report for valid range", async () => {
		const { router, reports } = buildRouter();
		reports.getAttendanceReport.mockResolvedValue({
			period: { start: "2025-10-01", end: "2025-10-19" },
			totals: {
				scheduled: 10,
				confirmed: 8,
				completed: 7,
				noShow: 1,
				cancellationRate: 0.1,
			},
		});

		const response = await router.request(
			"/reports/attendance?start=2025-10-01&end=2025-10-19",
			{
				method: "GET",
				headers: { Authorization: "Bearer token" },
			},
		);

		expect(response.status).toBe(200);
		expect(reports.getAttendanceReport).toHaveBeenCalledWith(
			expect.objectContaining({
				professionalId: 77,
				start: new Date("2025-10-01T00:00:00.000Z"),
				end: expect.any(Date),
			}),
		);
		expect(await response.json()).toEqual({
			period: { start: "2025-10-01", end: "2025-10-19" },
			totals: {
				scheduled: 10,
				confirmed: 8,
				completed: 7,
				noShow: 1,
				cancellationRate: 0.1,
			},
		});
	});

	it("validates report query parameters", async () => {
		const { router, reports } = buildRouter();
		reports.getAttendanceReport.mockResolvedValue({
			period: { start: "2025-10-01", end: "2025-10-19" },
			totals: {
				scheduled: 0,
				confirmed: 0,
				completed: 0,
				noShow: 0,
				cancellationRate: 0,
			},
		});

		const response = await router.request(
			"/reports/attendance?start=2025-10-20&end=2025-10-19",
			{
				method: "GET",
				headers: { Authorization: "Bearer token" },
			},
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			code: "VALIDATION_ERROR",
			message: "Payload inválido",
			details: { range: "Intervalo de datas inválido" },
		});
		expect(reports.getAttendanceReport).not.toHaveBeenCalled();
	});

	it("returns wait-times report", async () => {
		const { router, reports } = buildRouter();
		reports.getWaitTimesReport.mockResolvedValue({
			averageDaysToTriage: 3.5,
			averageDaysToTreatment: 5.2,
			medianQueueTime: 4,
		});

		const response = await router.request(
			"/reports/wait-times?start=2025-10-01&end=2025-10-19",
			{
				method: "GET",
				headers: { Authorization: "Bearer token" },
			},
		);

		expect(response.status).toBe(200);
		expect(reports.getWaitTimesReport).toHaveBeenCalledWith(
			expect.objectContaining({
				professionalId: 77,
				start: new Date("2025-10-01T00:00:00.000Z"),
			}),
		);
		expect(await response.json()).toEqual({
			averageDaysToTriage: 3.5,
			averageDaysToTreatment: 5.2,
			medianQueueTime: 4,
		});
	});

	it("returns adherence report", async () => {
		const { router, reports } = buildRouter();
		reports.getAdherenceReport.mockResolvedValue({
			period: { start: "2025-10-01", end: "2025-10-31" },
			totals: {
				completedAppointments: 12,
				symptomReportCount: 8,
			},
			patients: {
				withCompletedAppointments: 9,
				reportingSymptoms: 6,
				engaged: 5,
				engagementRate: 5 / 9,
			},
		});

		const response = await router.request(
			"/reports/adherence?start=2025-10-01&end=2025-10-31",
			{
				method: "GET",
				headers: { Authorization: "Bearer token" },
			},
		);

		expect(response.status).toBe(200);
		expect(reports.getAdherenceReport).toHaveBeenCalledWith(
			expect.objectContaining({
				professionalId: 77,
				start: new Date("2025-10-01T00:00:00.000Z"),
			}),
		);
		expect(await response.json()).toEqual({
			period: { start: "2025-10-01", end: "2025-10-31" },
			totals: {
				completedAppointments: 12,
				symptomReportCount: 8,
			},
			patients: {
				withCompletedAppointments: 9,
				reportingSymptoms: 6,
				engaged: 5,
				engagementRate: 5 / 9,
			},
		});
	});

	it("returns alerts report", async () => {
		const { router, reports } = buildRouter();
		reports.getAlertsReport.mockResolvedValue({
			period: { start: "2025-10-01", end: "2025-10-31" },
			totals: {
				status: { open: 4, acknowledged: 2, closed: 1 },
				severity: { low: 1, medium: 3, high: 3 },
			},
			recent: [
				{
					id: 88,
					patientId: 12,
					kind: "Sinais vitais alterados",
					severity: "high",
					status: "open",
					createdAt: new Date("2025-10-30T10:00:00.000Z").toISOString(),
				},
			],
		});

		const response = await router.request(
			"/reports/alerts?start=2025-10-01&end=2025-10-31",
			{
				method: "GET",
				headers: { Authorization: "Bearer token" },
			},
		);

		expect(response.status).toBe(200);
		expect(reports.getAlertsReport).toHaveBeenCalledWith(
			expect.objectContaining({
				professionalId: 77,
				start: new Date("2025-10-01T00:00:00.000Z"),
			}),
		);
		expect(await response.json()).toEqual({
			period: { start: "2025-10-01", end: "2025-10-31" },
			totals: {
				status: { open: 4, acknowledged: 2, closed: 1 },
				severity: { low: 1, medium: 3, high: 3 },
			},
			recent: [
				{
					id: 88,
					patientId: 12,
					kind: "Sinais vitais alterados",
					severity: "high",
					status: "open",
					createdAt: new Date("2025-10-30T10:00:00.000Z").toISOString(),
				},
			],
		});
	});
});