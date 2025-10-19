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
import * as patientSession from "../../lib/patient-session";
import type { PatientSessionPayload } from "../../lib/patient-session";
import { auth } from "../../lib/auth";
import * as usersRepository from "../../repositories/users";

const noopRateLimit: MiddlewareHandler<AppEnv> = async (_c, next) => {
	await next();
};

type RouterSetup = {
	router: ReturnType<typeof createAppRouter>;
	appointments: {
		confirmAttendance: ReturnType<typeof vi.fn>;
		declineAppointment: ReturnType<typeof vi.fn>;
		listAppointments: ReturnType<typeof vi.fn>;
		createAppointment: ReturnType<typeof vi.fn>;
		getAppointmentDetail: ReturnType<typeof vi.fn>;
		updateAppointment: ReturnType<typeof vi.fn>;
		cancelAppointment: ReturnType<typeof vi.fn>;
		updateAppointmentStatus: ReturnType<typeof vi.fn>;
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
	const appointments = {
		confirmAttendance: vi.fn(),
		declineAppointment: vi.fn(),
		listAppointments: vi.fn(),
		createAppointment: vi.fn(),
		getAppointmentDetail: vi.fn(),
		updateAppointment: vi.fn(),
		cancelAppointment: vi.fn(),
		updateAppointmentStatus: vi.fn(),
	};
	const alerts = { listAlerts: vi.fn(), getAlert: vi.fn(), updateAlert: vi.fn() };
	const reports = {
		getAttendanceReport: vi.fn(),
		getWaitTimesReport: vi.fn(),
	};
	const occurrences = {
		listPatientOccurrences: vi.fn(),
		createOccurrence: vi.fn(),
	} as unknown as OccurrenceService;

	const router = createAppRouter({
		patientAuth,
		patients,
		patientManagement: patientManagement as unknown as PatientManagementService,
		appointments: appointments as unknown as AppointmentService,
		alerts: alerts as unknown as AlertService,
		reports: reports as unknown as ReportsService,
		occurrences,
		patientLoginRateLimit: noopRateLimit,
	});

	return {
		router,
		appointments: appointments as RouterSetup["appointments"],
	};
}


describe("appointments routes", () => {
	let session: PatientSessionPayload;
	let verifySpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		session = {
			patientId: 321,
			sessionId: "session-id",
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
		};
		verifySpy = vi.spyOn(patientSession, "verifyPatientSession") as unknown as ReturnType<
			typeof vi.spyOn
		>;
		verifySpy.mockResolvedValue(session);
		vi.spyOn(auth.api, "getSession").mockResolvedValue({
			user: { id: "professional-ext" },
		} as never);
		vi.spyOn(usersRepository, "findUserWithRolesByExternalId").mockResolvedValue({
			id: 99,
			externalId: "professional-ext",
			roles: ["professional"],
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("confirms appointment for authenticated patient", async () => {
		const { router, appointments } = buildRouter();
		appointments.confirmAttendance.mockResolvedValue("confirmed");

		const response = await router.request("/appointments/55/confirm", {
			method: "POST",
			headers: {
				Cookie: "patient_session=token",
			},
		});

		expect(response.status).toBe(204);
		expect(appointments.confirmAttendance).toHaveBeenCalledWith(55, session.patientId);
	});

	it("returns validation error when appointment id is invalid", async () => {
		const { router, appointments } = buildRouter();

		const response = await router.request("/appointments/invalid/confirm", {
			method: "POST",
			headers: {
				Cookie: "patient_session=token",
			},
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			code: "VALIDATION_ERROR",
			message: "Payload inválido",
			details: { appointmentId: "ID inválido" },
		});
		expect(appointments.confirmAttendance).not.toHaveBeenCalled();
	});

	it("returns 401 when patient session is invalid", async () => {
		verifySpy.mockResolvedValueOnce(null);
		const { router, appointments } = buildRouter();

		const response = await router.request("/appointments/55/confirm", {
			method: "POST",
			headers: {
				Cookie: "patient_session=token",
			},
		});

		expect(response.status).toBe(401);
		expect(appointments.confirmAttendance).not.toHaveBeenCalled();
	});

	it("declines appointment with optional reason", async () => {
		const { router, appointments } = buildRouter();
		appointments.declineAppointment.mockResolvedValue(undefined);

		const response = await router.request("/appointments/55/decline", {
			method: "POST",
			headers: {
				Cookie: "patient_session=token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ reason: " indisponível " }),
		});

		expect(response.status).toBe(204);
		expect(appointments.declineAppointment).toHaveBeenCalledWith(
			55,
			session.patientId,
			"indisponível",
		);
	});

	it("returns 404 when decline target is missing", async () => {
		const { router, appointments } = buildRouter();
		appointments.declineAppointment.mockRejectedValue(new Error("APPOINTMENT_NOT_FOUND"));

		const response = await router.request("/appointments/999/decline", {
			method: "POST",
			headers: {
				Cookie: "patient_session=token",
			},
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			code: "NOT_FOUND",
			message: "Consulta não encontrada",
		});
	});

	it("lists appointments with day filter for professional", async () => {
		const { router, appointments } = buildRouter();
		const now = new Date("2025-10-10T13:30:00.000Z");
		appointments.listAppointments.mockResolvedValue({
			data: [
				{
					id: 1,
					patientId: 10,
					professionalId: 99,
					startsAt: now,
					type: "triage",
					status: "scheduled",
					notes: null,
					createdAt: now,
					updatedAt: now,
				},
			],
			total: 1,
		});

		const response = await router.request(
			"/appointments?day=2025-10-10&limit=5&offset=2&patientId=10",
			{
				method: "GET",
				headers: { Authorization: "Bearer token" },
			},
		);

		expect(response.status).toBe(200);
		expect(appointments.listAppointments).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 10,
				professionalId: 99,
				limit: 5,
				offset: 2,
			}),
		);
		const args = appointments.listAppointments.mock.calls[0][0];
		expect(args.start?.toISOString()).toBe("2025-10-10T00:00:00.000Z");
		expect(args.end?.toISOString()).toBe("2025-10-10T23:59:59.999Z");
		const payload = await response.json();
		expect(payload.meta).toEqual({ total: 1, limit: 5, offset: 2 });
	});

	it("validates day query format", async () => {
		const { router } = buildRouter();
		const response = await router.request("/appointments?day=20251010", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});
		expect(response.status).toBe(400);
	});

	it("creates appointment with default professional id", async () => {
		const { router, appointments } = buildRouter();
		const now = new Date("2025-10-11T12:00:00.000Z");
		appointments.createAppointment.mockResolvedValue({
			id: 77,
			patientId: 10,
			professionalId: 99,
			startsAt: now,
			type: "treatment",
			status: "scheduled",
			notes: "follow up",
			createdAt: now,
			updatedAt: now,
		});

		const response = await router.request("/appointments", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				patientId: 10,
				startsAt: "2025-10-11T12:00:00.000Z",
				type: "treatment",
				notes: "follow up",
			}),
		});

		expect(response.status).toBe(201);
		expect(appointments.createAppointment).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 10,
				professionalId: 99,
				startsAt: expect.any(Date),
			}),
			expect.objectContaining({ professionalId: 99 }),
		);
		const payload = await response.json();
		expect(payload.id).toBe(77);
	});

	it("returns 409 when creating appointment conflicts", async () => {
		const { router, appointments } = buildRouter();
		appointments.createAppointment.mockRejectedValue(new Error("APPOINTMENT_CONFLICT"));

		const response = await router.request("/appointments", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				patientId: 10,
				startsAt: "2025-10-11T12:00:00.000Z",
				type: "treatment",
			}),
		});

		expect(response.status).toBe(409);
		const payload = await response.json();
		expect(payload.code).toBe("APPOINTMENT_CONFLICT");
	});

	it("returns 404 when appointment detail missing", async () => {
		const { router, appointments } = buildRouter();
		appointments.getAppointmentDetail.mockResolvedValue(null);

		const response = await router.request("/appointments/999", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(404);
	});

	it("updates appointment and returns payload", async () => {
		const { router, appointments } = buildRouter();
		const updated = {
			id: 77,
			patientId: 10,
			professionalId: 99,
			startsAt: new Date("2025-10-12T15:00:00.000Z"),
			type: "return",
			status: "scheduled",
			notes: "note",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		appointments.updateAppointment.mockResolvedValue(updated);

		const response = await router.request("/appointments/77", {
			method: "PUT",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				startsAt: "2025-10-12T15:00:00.000Z",
				type: "return",
				notes: "note",
			}),
		});

		expect(response.status).toBe(200);
		expect(appointments.updateAppointment).toHaveBeenCalledWith(
			77,
			expect.objectContaining({
				startsAt: expect.any(Date),
				type: "return",
				notes: "note",
			}),
			expect.objectContaining({ professionalId: 99 }),
		);
		const payload = await response.json();
		expect(payload.id).toBe(77);
	});

	it("cancels appointment", async () => {
		const { router, appointments } = buildRouter();
		appointments.cancelAppointment.mockResolvedValue(undefined);

		const response = await router.request("/appointments/77", {
			method: "DELETE",
			headers: { Authorization: "Bearer token" },
		});

		expect(response.status).toBe(204);
		expect(appointments.cancelAppointment).toHaveBeenCalledWith(77, {
			professionalId: 99,
		});
	});

	it("updates appointment status", async () => {
		const { router, appointments } = buildRouter();
		appointments.updateAppointmentStatus.mockResolvedValue(undefined);

		const response = await router.request("/appointments/77/status", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: "confirmed", notes: "ok" }),
		});

		expect(response.status).toBe(204);
		expect(appointments.updateAppointmentStatus).toHaveBeenCalledWith(
			77,
			"confirmed",
			expect.objectContaining({ professionalId: 99, notes: "ok" }),
		);
	});
});
