import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { StatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../types/context";
import { requirePatient } from "../middlewares/require-patient";
import { requireProfessional } from "../middlewares/require-professional";
import type { PatientAuthService } from "../services/patient-auth";
import type { PatientService } from "../services/patients";
import type { PatientManagementService } from "../services/patient-management";
import type { AppointmentService, AppointmentUpdateInput } from "../services/appointments";
import type { AlertService, AlertEntity } from "../services/alerts";
import type { ReportsService } from "../services/reports";
import type { OccurrenceService } from "../services/occurrences";
import type { MiddlewareHandler } from "hono";
import { auth } from "../lib/auth";

const patientPinSchema = z.object({
	cpf: z
		.string()
		.trim()
		.regex(/^\d{11}$/, "CPF deve conter 11 dígitos"),
	pin: z
		.string()
		.trim()
		.min(4, "PIN deve ter ao menos 4 caracteres")
		.max(6, "PIN deve ter no máximo 6 caracteres"),
});

const appointmentStatusEnum = z.enum([
	"scheduled",
	"confirmed",
	"completed",
	"no_show",
	"canceled",
]);

const appointmentTypeEnum = z.enum(["triage", "treatment", "return"]);

const appointmentListQuerySchema = z.object({
	day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	patientId: z.coerce.number().int().positive().optional(),
	professionalId: z.coerce.number().int().positive().optional(),
	status: appointmentStatusEnum.optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

const appointmentCreateSchema = z.object({
	patientId: z.coerce.number().int().positive(),
	professionalId: z.coerce.number().int().positive().optional(),
	startsAt: z.string().trim().min(1),
	type: appointmentTypeEnum,
	notes: z.string().trim().max(2000).optional(),
});

const appointmentUpdateSchema = z
	.object({
		startsAt: z.string().trim().min(1).optional(),
		type: appointmentTypeEnum.optional(),
		notes: z.string().trim().max(2000).optional(),
	})
	.refine((value) => value.startsAt || value.type || value.notes !== undefined, {
		message: "Pelo menos um campo deve ser informado",
	});

const appointmentStatusUpdateSchema = z.object({
	status: appointmentStatusEnum,
	notes: z.string().trim().max(2000).optional(),
});

const appointmentDeclineSchema = z.object({
	reason: z.string().trim().max(2000).optional(),
});

const listAlertsSchema = z.object({
	status: z.enum(["open", "acknowledged", "closed"]).optional(),
	severity: z.enum(["low", "medium", "high"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

const reportRangeQuerySchema = z.object({
	start: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
	end: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

const alertUpdateSchema = z
	.object({
		status: z.enum(["open", "acknowledged", "closed"]).optional(),
		details: z.string().trim().max(2000).optional(),
		resolvedAt: z.string().datetime().nullable().optional(),
	})
	.refine(
		(value) =>
			value.status !== undefined ||
			value.details !== undefined ||
			value.resolvedAt !== undefined,
		{
			message: "Pelo menos um campo deve ser informado",
		},
	);

const patientListQuerySchema = z.object({
	q: z.string().min(1).optional(),
	status: z.enum(["active", "inactive", "at_risk"]).optional(),
	stage: z.enum(["pre_triage", "in_treatment", "post_treatment"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

function parseDayRange(day: string) {
	const start = new Date(`${day}T00:00:00.000Z`);
	if (Number.isNaN(start.getTime())) {
		return null;
	}
	const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
	return { start, end } as const;
}

function parseDateRange(start: string, end: string) {
	const rangeStart = new Date(`${start}T00:00:00.000Z`);
	const rangeEnd = new Date(`${end}T00:00:00.000Z`);
	if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
		return null;
	}
	rangeEnd.setUTCHours(23, 59, 59, 999);
	if (rangeStart.getTime() > rangeEnd.getTime()) {
		return null;
	}
	return { start: rangeStart, end: rangeEnd } as const;
}

const patientContactInputSchema = z.object({
	fullName: z.string().trim().min(1),
	relation: z.string().trim().min(1),
	phone: z.string().trim().min(1),
	isPrimary: z.boolean().optional(),
});

const patientCreateSchema = z.object({
	fullName: z.string().trim().min(1),
	cpf: z
		.string()
		.trim()
		.regex(/^\d{11}$/),
	pin: z
		.string()
		.trim()
		.regex(/^\d{6}$/),
	birthDate: z.string().trim().min(1).optional(),
	phone: z.string().trim().optional(),
	emergencyPhone: z.string().trim().optional(),
	tumorType: z.string().trim().optional(),
	clinicalUnit: z.string().trim().optional(),
	stage: z.enum(["pre_triage", "in_treatment", "post_treatment"]).optional(),
	status: z.enum(["active", "inactive", "at_risk"]).optional(),
	audioMaterialUrl: z.string().trim().url().optional(),
	contacts: z.array(patientContactInputSchema).max(20).optional(),
});

const patientSearchSchema = z.object({
	q: z.string().trim().min(1),
	limit: z.coerce.number().int().min(1).max(50).optional(),
});

const occurrenceCreateSchema = z.object({
	kind: z.string().trim().min(1),
	intensity: z.coerce.number().int().min(0).max(10),
	source: z.enum(["patient", "professional"]),
	notes: z.string().trim().min(1).optional(),
});

function validationError(details: unknown) {
	return {
		code: "VALIDATION_ERROR",
		message: "Payload inválido",
		details,
	};
}

type AppRouterDeps = {
	patientAuth: PatientAuthService;
	patients: PatientService;
	patientManagement: PatientManagementService;
	appointments: AppointmentService;
	alerts: AlertService;
	occurrences: OccurrenceService;
	reports: ReportsService;
	patientLoginRateLimit: MiddlewareHandler<AppEnv>;
};

function getClientIp(c: Parameters<MiddlewareHandler<AppEnv>>[0]): string | null {
	return (
		c.req.header("cf-connecting-ip") ||
		c.req.header("x-forwarded-for") ||
		c.req.header("x-real-ip") ||
		c.req.header("x-client-ip") ||
		null
	);
}

function getUserAgent(c: Parameters<MiddlewareHandler<AppEnv>>[0]) {
	return c.req.header("user-agent") || null;
}

function normalizeNullableString(value?: string | null) {
	if (value === undefined || value === null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function mapPatientLoginError(error: unknown):
	| {
		status: 401 | 423;
		body: { code: string; message: string };
	}
	| null {
	if (!(error instanceof Error)) return null;
	switch (error.message) {
		case "PATIENT_NOT_FOUND":
		case "INVALID_PIN":
			return {
				status: 401,
				body: {
					code: "INVALID_CREDENTIALS",
					message: "CPF ou PIN inválidos",
				},
			};
		case "PATIENT_PIN_BLOCKED":
			return {
				status: 423,
				body: {
					code: "ACCOUNT_LOCKED",
					message: "Paciente bloqueado temporariamente. Tente novamente mais tarde.",
				},
			};
		default:
			return null;
	}
}

function mapPatientCreateError(error: unknown):
	| {
		status: 409;
		body: { code: string; message: string };
	}
	| null {
	if (!(error instanceof Error)) return null;
	if (error.message === "PATIENT_DUPLICATE") {
		return {
			status: 409,
			body: {
				code: "UNIQUE_CONSTRAINT",
				message: "Paciente com este CPF já está cadastrado.",
			},
		};
	}
	return null;
}

function notFound(message: string) {
	return {
		code: "NOT_FOUND",
		message,
	};
}

function mapAppointmentError(error: unknown):
	|
		{
			status: number;
			body: { code: string; message: string };
		}
	| null {
	if (!(error instanceof Error)) {
		return null;
	}
	if (error.message === "APPOINTMENT_CONFLICT") {
		return {
			status: 409,
			body: {
				code: "APPOINTMENT_CONFLICT",
				message: "Já existe consulta para este horário",
			},
		};
	}
	if (error.message === "APPOINTMENT_NOT_FOUND") {
		return {
			status: 404,
			body: notFound("Consulta não encontrada"),
		};
	}
	return null;
}

export function createAppRouter(deps: AppRouterDeps) {
	const {
		patientAuth,
		patients,
		patientManagement,
		appointments,
		alerts,
		occurrences,
		reports,
		patientLoginRateLimit,
	} = deps;
	const router = new Hono<AppEnv>();

	const authRouter = new Hono<AppEnv>();
	authRouter.post(
		"/patient-pin",
		patientLoginRateLimit,
		async (c) => {
			let body: unknown;
			try {
				body = await c.req.json();
			} catch (error) {
				return c.json(validationError("JSON inválido"), 400);
			}
			const parsed = patientPinSchema.safeParse(body);
			if (!parsed.success) {
				return c.json(validationError(parsed.error.flatten()), 400);
			}
			const { cpf, pin } = parsed.data;
			try {
				const result = await patientAuth.loginWithPin({
					cpf,
					pin,
					ip: getClientIp(c),
					userAgent: getUserAgent(c),
				});
				const { token, expiresAt } = result;

				setCookie(c, "patient_session", token, {
					httpOnly: true,
					secure: true,
					sameSite: "Strict",
					path: "/",
					expires: expiresAt,
				});

				return c.body(null, 204);
			} catch (error) {
				const mapped = mapPatientLoginError(error);
				if (mapped) {
					c.status(mapped.status as StatusCode);
					return c.json(mapped.body);
				}
				throw error;
			}
		},
	);

	authRouter.post("/logout", async (c) => {
		const logger = c.get("logger");
		const patientCookie = getCookie(c, "patient_session");
		if (patientCookie) {
			deleteCookie(c, "patient_session", { path: "/" });
		}
		const authorization = c.req.header("authorization");
		if (authorization?.toLowerCase().startsWith("bearer")) {
			try {
				await auth.api.signOut({ headers: c.req.raw.headers });
			} catch (error) {
				logger?.warn("Failed to sign out professional session", {
					message: error instanceof Error ? error.message : "unknown",
				});
			}
		}
		return c.body(null, 204);
	});

	authRouter.all("/*", (c) => auth.handler(c.req.raw));

	router.route("/auth", authRouter);

	router.get("/patients/me", requirePatient, async (c) => {
		const patientSession = c.get("patient");
		if (!patientSession) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const view = await patients.getMobileView(patientSession.id);
		return c.json(view);
	});

	router.get("/patients/search", requireProfessional, async (c) => {
		const parsed = patientSearchSchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const { q, limit } = parsed.data;
		const results = await patientManagement.searchPatients(q, limit);
		return c.json(results);
	});

	router.get("/patients", requireProfessional, async (c) => {
		const parsed = patientListQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const { q, status, stage, limit, offset } = parsed.data;
		const result = await patientManagement.listPatients({ q, status, stage, limit, offset });
		return c.json({
			data: result.data,
			meta: {
				total: result.total,
				limit: limit ?? 20,
				offset: offset ?? 0,
			},
		});
	});

	router.post("/patients", requireProfessional, async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}
		const parsed = patientCreateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const data = parsed.data;
		const birthDate = data.birthDate ? new Date(data.birthDate) : null;
		if (birthDate && Number.isNaN(birthDate.getTime())) {
			return c.json(
				validationError({ birthDate: "Data inválida" }),
				400,
			);
		}
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		try {
			const patient = await patientManagement.createPatient(
				{
					fullName: data.fullName,
					cpf: data.cpf,
					pin: data.pin,
					birthDate,
					phone: normalizeNullableString(data.phone),
					emergencyPhone: normalizeNullableString(data.emergencyPhone),
					tumorType: normalizeNullableString(data.tumorType),
					clinicalUnit: normalizeNullableString(data.clinicalUnit),
					stage: data.stage,
					status: data.status,
					audioMaterialUrl: data.audioMaterialUrl ?? null,
					contacts: data.contacts?.map((contact) => ({
						fullName: contact.fullName,
						relation: contact.relation,
						phone: contact.phone,
						isPrimary: contact.isPrimary,
					})),
				},
				{ professionalId: professional.id },
			);
			const response = c.json(patient, 201);
			response.headers.append("Location", `/patients/${patient.id}`);
			return response;
		} catch (error) {
			const mapped = mapPatientCreateError(error);
			if (mapped) {
				c.status(mapped.status as StatusCode);
				return c.json(mapped.body);
			}
			throw error;
		}
	});

	router.get("/patients/:id", requireProfessional, async (c) => {
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		const detail = await patientManagement.getPatientDetail(idParam);
		if (!detail) {
			return c.json(notFound("Paciente não encontrado"), 404);
		}
		return c.json(detail);
	});

	router.get("/patients/:id/occurrences", requireProfessional, async (c) => {
		const patientId = Number(c.req.param("id"));
		if (Number.isNaN(patientId)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		const list = await occurrences.listPatientOccurrences(patientId);
		return c.json(list);
	});

	router.post("/patients/:id/occurrences", requireProfessional, async (c) => {
		const patientId = Number(c.req.param("id"));
		if (Number.isNaN(patientId)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}
		const parsed = occurrenceCreateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const data = parsed.data;
		const occurrence = await occurrences.createOccurrence(
			patientId,
			{
				kind: data.kind,
				intensity: data.intensity,
				source: data.source,
				notes: normalizeNullableString(data.notes),
			},
			{ professionalId: professional.id },
		);
		return c.json(occurrence, 201);
	});

	router.post("/appointments/:id/confirm", requirePatient, async (c) => {
		const patientSession = c.get("patient");
		if (!patientSession) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const idParam = c.req.param("id");
		const appointmentId = Number(idParam);
		if (!idParam || Number.isNaN(appointmentId)) {
			return c.json(validationError({ appointmentId: "ID inválido" }), 400);
		}
		await appointments.confirmAttendance(appointmentId, patientSession.id);
		return c.body(null, 204);
	});

	router.post("/appointments/:id/decline", requirePatient, async (c) => {
		const patientSession = c.get("patient");
		if (!patientSession) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const idParam = c.req.param("id");
		const appointmentId = Number(idParam);
		if (!idParam || Number.isNaN(appointmentId)) {
			return c.json(validationError({ appointmentId: "ID inválido" }), 400);
		}
		let body: unknown = {};
		const rawBody = await c.req.text();
		if (rawBody.trim().length > 0) {
			try {
				body = JSON.parse(rawBody);
			} catch (error) {
				return c.json(validationError("JSON inválido"), 400);
			}
		}
		const parsed = appointmentDeclineSchema.safeParse(body ?? {});
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		try {
			const reason = parsed.data ? normalizeNullableString(parsed.data.reason) : null;
			await appointments.declineAppointment(
				appointmentId,
				patientSession.id,
				reason,
			);
			return c.body(null, 204);
		} catch (error) {
			const mapped = mapAppointmentError(error);
			if (mapped) {
				c.status(mapped.status as StatusCode);
				return c.json(mapped.body);
			}
			throw error;
		}
	});

	router.get("/appointments", requireProfessional, async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const parsed = appointmentListQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		let rangeStart: Date | undefined;
		let rangeEnd: Date | undefined;
		if (parsed.data.day) {
			const range = parseDayRange(parsed.data.day);
			if (!range) {
				return c.json(validationError({ day: "Data inválida" }), 400);
			}
			rangeStart = range.start;
			rangeEnd = range.end;
		}
		const limit = parsed.data.limit ?? 20;
		const offset = parsed.data.offset ?? 0;
		const result = await appointments.listAppointments({
			start: rangeStart,
			end: rangeEnd,
			patientId: parsed.data.patientId,
			professionalId: parsed.data.professionalId ?? professional.id,
			status: parsed.data.status,
			limit,
			offset,
		});
		return c.json({
			data: result.data,
			meta: {
				total: result.total,
				limit,
				offset,
			},
		});
	});

	router.get("/appointments/:id", requireProfessional, async (c) => {
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		const detail = await appointments.getAppointmentDetail(idParam);
		if (!detail) {
			return c.json(notFound("Consulta não encontrada"), 404);
		}
		return c.json(detail);
	});

	router.post("/appointments", requireProfessional, async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}
		const parsed = appointmentCreateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const startsAt = new Date(parsed.data.startsAt);
		if (Number.isNaN(startsAt.getTime())) {
			return c.json(validationError({ startsAt: "Data/hora inválida" }), 400);
		}
		try {
			const appointment = await appointments.createAppointment(
				{
					patientId: parsed.data.patientId,
					professionalId: parsed.data.professionalId ?? professional.id,
					startsAt,
					type: parsed.data.type,
					notes: parsed.data.notes ?? null,
				},
				{ professionalId: professional.id },
			);
			return c.json(appointment, 201);
		} catch (error) {
			const mapped = mapAppointmentError(error);
			if (mapped) {
				c.status(mapped.status as StatusCode);
				return c.json(mapped.body);
			}
			throw error;
		}
	});

	router.put("/appointments/:id", requireProfessional, async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}
		const parsed = appointmentUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const updateInput: AppointmentUpdateInput = {};
		if (parsed.data.startsAt) {
			const startsAt = new Date(parsed.data.startsAt);
			if (Number.isNaN(startsAt.getTime())) {
				return c.json(validationError({ startsAt: "Data/hora inválida" }), 400);
			}
			updateInput.startsAt = startsAt;
		}
		if (parsed.data.type) {
			updateInput.type = parsed.data.type;
		}
		if (parsed.data.notes !== undefined) {
			updateInput.notes = parsed.data.notes;
		}
		try {
			const appointment = await appointments.updateAppointment(
				idParam,
				updateInput,
				{ professionalId: professional.id },
			);
			return c.json(appointment);
		} catch (error) {
			const mapped = mapAppointmentError(error);
			if (mapped) {
				c.status(mapped.status as StatusCode);
				return c.json(mapped.body);
			}
			throw error;
		}
	});

	router.delete("/appointments/:id", requireProfessional, async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		try {
			await appointments.cancelAppointment(idParam, {
				professionalId: professional.id,
			});
			return c.body(null, 204);
		} catch (error) {
			const mapped = mapAppointmentError(error);
			if (mapped) {
				c.status(mapped.status as StatusCode);
				return c.json(mapped.body);
			}
			throw error;
		}
	});

	router.post("/appointments/:id/status", requireProfessional, async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}
		const parsed = appointmentStatusUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		try {
			await appointments.updateAppointmentStatus(idParam, parsed.data.status, {
				professionalId: professional.id,
				notes: parsed.data.notes,
			});
			return c.body(null, 204);
		} catch (error) {
			const mapped = mapAppointmentError(error);
			if (mapped) {
				c.status(mapped.status as StatusCode);
				return c.json(mapped.body);
			}
			throw error;
		}
	});

	const reportsRouter = new Hono<AppEnv>();
	reportsRouter.use(requireProfessional);
	reportsRouter.get("/attendance", async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const parsed = reportRangeQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const range = parseDateRange(parsed.data.start, parsed.data.end);
		if (!range) {
			return c.json(
				validationError({ range: "Intervalo de datas inválido" }),
				400,
			);
		}
		const report = await reports.getAttendanceReport({
			professionalId: professional.id,
			start: range.start,
			end: range.end,
		});
		return c.json(report);
	});
	reportsRouter.get("/wait-times", async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const parsed = reportRangeQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const range = parseDateRange(parsed.data.start, parsed.data.end);
		if (!range) {
			return c.json(
				validationError({ range: "Intervalo de datas inválido" }),
				400,
			);
		}
		const report = await reports.getWaitTimesReport({
			professionalId: professional.id,
			start: range.start,
			end: range.end,
		});
		return c.json(report);
	});

	const alertsRouter = new Hono<AppEnv>();
	alertsRouter.use(requireProfessional);
	alertsRouter.get("/", async (c) => {
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const parsed = listAlertsSchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		const { limit, offset, status, severity } = parsed.data;
		const result = await alerts.listAlerts({
			professionalId: professional.id,
			limit,
			offset,
			status,
			severity,
		});
		return c.json({
			data: result.data,
			meta: {
				total: result.total,
				limit: limit ?? 20,
				offset: offset ?? 0,
			},
		});
	});

	alertsRouter.get("/:id", async (c) => {
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		const alert = await alerts.getAlert(idParam);
		if (!alert) {
			return c.json(notFound("Alerta não encontrado"), 404);
		}
		return c.json(alert);
	});

	alertsRouter.patch("/:id", async (c) => {
		const idParam = Number(c.req.param("id"));
		if (Number.isNaN(idParam)) {
			return c.json(validationError({ id: "ID inválido" }), 400);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}
		const parsed = alertUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}
		let resolvedAt: Date | null | undefined;
		if (parsed.data.resolvedAt !== undefined) {
			if (parsed.data.resolvedAt === null) {
				resolvedAt = null;
			} else {
				const parsedDate = new Date(parsed.data.resolvedAt);
				if (Number.isNaN(parsedDate.getTime())) {
					return c.json(validationError({ resolvedAt: "Data inválida" }), 400);
				}
				resolvedAt = parsedDate;
			}
		}
		const updateInput: {
			status?: (typeof parsed.data)["status"];
			details?: string | null;
			resolvedAt?: Date | null;
		} = {};
		if (parsed.data.status !== undefined) {
			updateInput.status = parsed.data.status;
		}
		if (parsed.data.details !== undefined) {
			updateInput.details = normalizeNullableString(parsed.data.details);
		}
		if (resolvedAt !== undefined) {
			updateInput.resolvedAt = resolvedAt;
		}
		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const updated = await alerts.updateAlert(
			idParam,
			updateInput,
			{ professionalId: professional.id },
		);
		if (!updated) {
			return c.json(notFound("Alerta não encontrado"), 404);
		}
		return c.json(updated);
	});

	router.route("/reports", reportsRouter);
	router.route("/alerts", alertsRouter);

	return router;
}

export type AppRouter = ReturnType<typeof createAppRouter>;
