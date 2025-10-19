import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "..";
import type { PatientAuthService } from "../../services/patient-auth";
import type { PatientService } from "../../services/patients";
import type { AppointmentService } from "../../services/appointments";
import type { AlertService } from "../../services/alerts";
import type { ReportsService } from "../../services/reports";
import type { OccurrenceService } from "../../services/occurrences";
import type { PatientManagementService } from "../../services/patient-management";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../../types/context";
import { auth } from "../../lib/auth";

const noopRateLimit: MiddlewareHandler<AppEnv> = async (_c, next) => {
	await next();
};

type RouterSetup = {
	router: ReturnType<typeof createAppRouter>;
	loginWithPin: ReturnType<typeof vi.fn>;
};

function buildRouter(): RouterSetup {
	const loginWithPin = vi.fn();
	const patientAuth = { loginWithPin } as unknown as PatientAuthService;
	const patients = { getMobileView: vi.fn() } as unknown as PatientService;
	const appointments = { confirmAttendance: vi.fn() } as unknown as AppointmentService;
	const alerts = { listAlerts: vi.fn(), getAlert: vi.fn(), updateAlert: vi.fn() } as unknown as AlertService;
	const reports = {
		getAttendanceReport: vi.fn(),
		getWaitTimesReport: vi.fn(),
	} as unknown as ReportsService;
	const patientManagement = {
		listPatients: vi.fn(),
		createPatient: vi.fn(),
	} as unknown as PatientManagementService;
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
	return { router, loginWithPin };
}

describe("auth routes", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sets patient session cookie on successful PIN login", async () => {
		const { router, loginWithPin } = buildRouter();
		const expiresAt = new Date(Date.now() + 3_600_000);
		loginWithPin.mockResolvedValue({
			token: "session-token",
			expiresAt,
			patient: { id: 1 } as unknown,
		});

		const response = await router.request("/auth/patient-pin", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cpf: "12345678901", pin: "123456" }),
		});

		expect(response.status).toBe(204);
		expect(loginWithPin).toHaveBeenCalledWith(
			expect.objectContaining({ cpf: "12345678901", pin: "123456" }),
		);
		expect(response.headers.get("set-cookie")).toContain("patient_session=");
	});

	it("returns 423 when patient PIN is blocked", async () => {
		const { router, loginWithPin } = buildRouter();
		loginWithPin.mockRejectedValue(new Error("PATIENT_PIN_BLOCKED"));

		const response = await router.request("/auth/patient-pin", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cpf: "12345678901", pin: "123456" }),
		});

		expect(response.status).toBe(423);
		const payload = await response.json();
		expect(payload).toEqual({
			code: "ACCOUNT_LOCKED",
			message: "Paciente bloqueado temporariamente. Tente novamente mais tarde.",
		});
	});

	it("returns 401 for invalid credentials", async () => {
		const { router, loginWithPin } = buildRouter();
		loginWithPin.mockRejectedValue(new Error("PATIENT_NOT_FOUND"));

		const response = await router.request("/auth/patient-pin", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cpf: "12345678901", pin: "123456" }),
		});

		expect(response.status).toBe(401);
		const payload = await response.json();
		expect(payload).toEqual({
			code: "INVALID_CREDENTIALS",
			message: "CPF ou PIN inválidos",
		});
	});

	it("clears patient cookie on logout", async () => {
		const { router } = buildRouter();

		const response = await router.request("/auth/logout", {
			method: "POST",
			headers: { cookie: "patient_session=token" },
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toMatch(/patient_session=;.*Max-Age=0/i);
	});

	it("delegates logout to Better Auth for professionals", async () => {
		const signOutSpy = vi.spyOn(auth.api, "signOut").mockResolvedValue(undefined as never);
		const { router } = buildRouter();

		const response = await router.request("/auth/logout", {
			method: "POST",
			headers: { authorization: "Bearer token" },
		});

		expect(response.status).toBe(204);
		expect(signOutSpy).toHaveBeenCalledTimes(1);
		expect(signOutSpy).toHaveBeenCalledWith({ headers: expect.any(Headers) });
	});
});
