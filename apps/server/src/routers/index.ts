import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { StatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../types/context";
import { requirePatient } from "../middlewares/require-patient";
import { requireProfessional } from "../middlewares/require-professional";
import { requireAdmin } from "../middlewares/require-admin";
import type { PatientAuthService } from "../services/patient-auth";
import type { PatientService } from "../services/patients";
import type {
	PatientManagementService,
	PatientEntity,
	PatientContactEntity,
	OccurrenceEntity,
	AlertEntity as PatientAlertEntity,
	PatientUpdateInput,
} from "../services/patient-management";
import type { AppointmentService, AppointmentUpdateInput } from "../services/appointments";
import type { AlertService } from "../services/alerts";
import type { ReportsService } from "../services/reports";
import type { OccurrenceService } from "../services/occurrences";
import {
	ProfessionalDeleteError,
	ProfessionalOnboardingError,
	ProfessionalProfileUpdateError,
} from "../services/professionals";
import type { ProfessionalDirectoryService, ProfessionalOnboardingService } from "../services/professionals";
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

const patientAppointmentsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).optional(),
});

const patientOccurrenceCreateSchema = z.object({
	kind: z.string().trim().min(1),
	intensity: z.coerce.number().int().min(0).max(10),
	notes: z.string().trim().min(1).optional(),
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
		.regex(/^\d{4,6}$/),
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

const patientUpdateSchema = z
	.object({
		fullName: z.string().trim().min(1).optional(),
		birthDate: z.union([z.string().trim(), z.null()]).optional(),
		phone: z.string().trim().optional().nullable(),
		emergencyPhone: z.string().trim().optional().nullable(),
		tumorType: z.string().trim().optional().nullable(),
		clinicalUnit: z.string().trim().optional().nullable(),
		stage: z.enum(["pre_triage", "in_treatment", "post_treatment"]).optional(),
		status: z.enum(["active", "inactive", "at_risk"]).optional(),
		audioMaterialUrl: z.string().trim().url().optional().nullable(),
	})
	.refine((value) => Object.values(value).some((field) => field !== undefined), {
		message: "Informe ao menos um campo para atualizar",
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

const professionalOnboardingSchema = z
	.object({
		fullName: z.string().trim().min(3, "Informe seu nome completo"),
		documentId: z
			.string()
			.trim()
			.min(11, "CPF deve conter 11 dígitos")
			.max(20, "CPF deve conter no máximo 20 caracteres")
			.refine((value) => value.replace(/\D/g, "").length === 11, {
				message: "CPF deve conter 11 dígitos",
			}),
		specialty: z.string().trim().min(2, "Informe a especialidade"),
		phone: z.preprocess(
			(value) => {
				if (typeof value !== "string") return value;
				const trimmed = value.trim();
				return trimmed.length === 0 ? undefined : trimmed;
			},
			z
				.string()
				.min(10, "Telefone deve conter ao menos 10 dígitos")
				.max(20, "Telefone deve conter no máximo 20 caracteres")
				.refine((value) => value.replace(/\D/g, "").length >= 10, {
					message: "Telefone deve conter ao menos 10 dígitos",
				})
				.optional(),
		),
	})
	.strict();

const professionalStatusFilter = z.enum(["active", "inactive"]);

const professionalListQuerySchema = z.object({
	q: z.string().trim().min(1).max(120).optional(),
	status: professionalStatusFilter.optional(),
	includeSummary: z.coerce.boolean().optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

const professionalIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

const professionalProfileUpdateSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(3, "Informe seu nome completo")
			.max(120, "Nome deve conter no máximo 120 caracteres")
			.optional(),
		specialty: z
			.union([
				z
					.string()
					.trim()
					.max(120, "Especialidade deve conter no máximo 120 caracteres"),
				z.null(),
			])
			.optional(),
		phone: z
			.union([
				z
					.string()
					.trim()
					.max(20, "Telefone deve conter no máximo 20 caracteres"),
				z.null(),
			])
			.optional(),
		avatarDataUrl: z
			.union([
				z
					.string()
					.trim()
					.max(2_000_000, "Imagem deve ter no máximo 2MB"),
				z.null(),
			])
			.optional(),
	})
	.superRefine((value, ctx) => {
		if (!Object.values(value).some((field) => field !== undefined)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Informe ao menos um campo para atualizar.",
			});
		}
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
	professionals: ProfessionalOnboardingService;
	professionalDirectory?: ProfessionalDirectoryService;
	patientLoginRateLimit: MiddlewareHandler<AppEnv>;
};

const noopProfessionalDirectory: ProfessionalDirectoryService = {
	async listProfessionals() {
		return { data: [], total: 0, limit: 0, offset: 0 };
	},
	async getSummary() {
		return { total: 0, active: 0, inactive: 0 };
	},
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

function formatDateOnly(value: Date | null | undefined) {
	if (!value) return null;
	return value.toISOString().split("T")[0] ?? null;
}

function toIsoStringValue(value?: Date | string | null) {
	if (!value) {
		return null;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function serializeProfessionalProfile(profile: {
	id: number;
	name?: string | null;
	email?: string | null;
	documentId?: string | null;
	specialty?: string | null;
	phone?: string | null;
	avatarUrl?: string | null;
	isActive?: boolean | null;
	mustChangePassword?: boolean | null;
	roles: string[];
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
}) {
	return {
		id: profile.id,
		name: profile.name ?? "",
		email: profile.email ?? "",
		documentId: profile.documentId ?? "",
		specialty: profile.specialty ?? null,
		phone: profile.phone ?? null,
		avatarUrl: profile.avatarUrl ?? null,
		isActive: profile.isActive ?? true,
		mustChangePassword: profile.mustChangePassword ?? false,
		roles: profile.roles,
		createdAt: toIsoStringValue(profile.createdAt),
		updatedAt: toIsoStringValue(profile.updatedAt),
	};
}

function serializePatientEntity(patient: PatientEntity) {
	return {
		id: patient.id,
		fullName: patient.fullName,
		cpf: patient.cpf,
		birthDate: formatDateOnly(patient.birthDate ?? null),
		phone: patient.phone ?? null,
		emergencyPhone: patient.emergencyPhone ?? null,
		tumorType: patient.tumorType ?? null,
		clinicalUnit: patient.clinicalUnit ?? null,
		stage: patient.stage,
		status: patient.status,
		audioMaterialUrl: patient.audioMaterialUrl ?? null,
		pinAttempts: patient.pinAttempts,
		pinBlockedUntil: patient.pinBlockedUntil
			? patient.pinBlockedUntil.toISOString()
			: null,
		createdAt: patient.createdAt.toISOString(),
		updatedAt: patient.updatedAt.toISOString(),
	};
}

function serializePatientContact(contact: PatientContactEntity) {
	return {
		id: contact.id,
		fullName: contact.name,
		relation: contact.relation ?? "",
		phone: contact.phone,
		isPrimary: false,
	};
}

function serializeOccurrence(occurrence: OccurrenceEntity) {
	return {
		id: occurrence.id,
		patientId: occurrence.patientId,
		professionalId: occurrence.professionalId,
		kind: occurrence.kind,
		intensity: occurrence.intensity,
		source: occurrence.source,
		notes: occurrence.notes ?? null,
		createdAt: occurrence.createdAt.toISOString(),
	};
}

function serializeAlert(alert: PatientAlertEntity) {
	return {
		id: alert.id,
		patientId: alert.patientId,
		kind: alert.kind,
		severity: alert.severity,
		status: alert.status,
		details: alert.details ?? null,
		createdAt: alert.createdAt.toISOString(),
		resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
		resolvedBy: alert.resolvedBy ?? null,
	};
}

function serializePatientDetail(detail: {
	patient: PatientEntity;
	contacts: PatientContactEntity[];
	occurrences: OccurrenceEntity[];
	alerts: PatientAlertEntity[];
}) {
	return {
		...serializePatientEntity(detail.patient),
		contacts: detail.contacts.map(serializePatientContact),
		occurrences: detail.occurrences.map(serializeOccurrence),
		alerts: detail.alerts.map(serializeAlert),
	};
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

function mapProfessionalDeleteError(error: unknown): { status: StatusCode; body: unknown } | null {
	if (!(error instanceof ProfessionalDeleteError)) {
		return null;
	}

	switch (error.code) {
		case "NOT_FOUND":
			return {
				status: 404 as StatusCode,
				body: {
					code: "PROFESSIONAL_NOT_FOUND",
					message: "Profissional não encontrado.",
				},
			};
		case "HAS_DEPENDENCIES":
			return {
				status: 409 as StatusCode,
				body: {
					code: "PROFESSIONAL_IN_USE",
					message:
						"Não é possível excluir o profissional porque existem registros vinculados (agendamentos ou ocorrências).",
				},
			};
		default:
			return {
				status: 500 as StatusCode,
				body: {
					code: "PROFESSIONAL_DELETE_FAILED",
					message: "Não foi possível remover o profissional. Tente novamente mais tarde.",
				},
			};
	}
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
		professionals,
		professionalDirectory = noopProfessionalDirectory,
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

	router.get("/professionals", requireProfessional, async (c) => {
		const parsed = professionalListQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}

		const { includeSummary = false, q, status, limit, offset } = parsed.data;
		const listResult = await professionalDirectory.listProfessionals({
			q,
			status,
			limit,
			offset,
		});
		const summary = includeSummary ? await professionalDirectory.getSummary() : null;

		return c.json({
			data: listResult.data,
			meta: {
				total: listResult.total,
				limit: listResult.limit,
				offset: listResult.offset,
				...(summary ? { statusCounts: summary } : {}),
			},
		});
	});

		router.delete("/professionals/:id", requireAdmin, async (c) => {
			const parsed = professionalIdParamSchema.safeParse(c.req.param());
			if (!parsed.success) {
				return c.json(validationError(parsed.error.flatten()), 400);
			}

			try {
				await professionals.deleteProfessional(parsed.data.id);
			} catch (error) {
				const mapped = mapProfessionalDeleteError(error);
				if (mapped) {
					c.status(mapped.status);
					return c.json(mapped.body);
				}
				throw error;
			}

			return c.body(null, 204);
		});

	router.post("/professionals/onboarding", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!session) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}

		let body: unknown;
		try {
			body = await c.req.json();
		} catch (error) {
			return c.json(validationError("JSON inválido"), 400);
		}

		const parsed = professionalOnboardingSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}

		const email = session.user.email;
		if (!email) {
			return c.json(validationError({ email: "Sessão inválida" }), 400);
		}

		const { fullName, documentId, specialty, phone } = parsed.data;

		try {
			const result = await professionals.completeOnboarding({
				externalId: session.user.id,
				fullName,
				email,
				documentId,
				specialty,
				phone,
			});

			return c.json({
				status: result.isNewUser ? "created" : "updated",
				userId: result.userId,
				roles: result.roles,
			});
		} catch (error) {
			if (error instanceof ProfessionalOnboardingError) {
				switch (error.code) {
					case "INVALID_DOCUMENT":
						return c.json(validationError({ documentId: "CPF deve conter 11 dígitos" }), 400);
					case "DOCUMENT_IN_USE":
						return c.json(
							{
								code: "DOCUMENT_IN_USE",
								message: "Já existe um profissional cadastrado com este CPF.",
							},
							409,
						);
					case "MISSING_ACCOUNT":
						return c.json(
							{
								code: "MISSING_ACCOUNT",
								message: "Não foi possível localizar a conta do usuário.",
							},
							400,
						);
					case "ROLE_NOT_FOUND":
						return c.json(
							{
								code: "ROLE_NOT_FOUND",
								message: "Papel profissional não configurado no sistema.",
							},
							500,
						);
				}
			}
			throw error;
		}
	});

		router.get("/professionals/me", requireProfessional, async (c) => {
			const professional = c.get("professional");
			if (!professional) {
				throw new HTTPException(401, { message: "UNAUTHENTICATED" });
			}
			return c.json(
				serializeProfessionalProfile({
					id: professional.id,
					name: professional.name ?? "",
					email: professional.email ?? "",
					documentId: professional.documentId ?? "",
					specialty: professional.specialty ?? null,
					phone: professional.phone ?? null,
					avatarUrl: professional.avatarUrl ?? null,
					isActive: professional.isActive ?? true,
					mustChangePassword: professional.mustChangePassword ?? false,
					roles: professional.roles,
					createdAt: professional.createdAt ?? null,
					updatedAt: professional.updatedAt ?? null,
				}),
			);
		});

		router.patch("/professionals/me", requireProfessional, async (c) => {
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

			const parsed = professionalProfileUpdateSchema.safeParse(body);
			if (!parsed.success) {
				return c.json(validationError(parsed.error.flatten()), 400);
			}

			const updateInput: {
				userId: number;
				name?: string;
				specialty?: string | null;
				phone?: string | null;
				avatarDataUrl?: string | null;
			} = {
				userId: professional.id,
			};

			if (parsed.data.name !== undefined) {
				const normalized = parsed.data.name.trim();
				if (normalized.length === 0) {
					return c.json(validationError({ name: "Nome não pode ficar em branco." }), 400);
				}
				updateInput.name = normalized;
			}

			if (parsed.data.specialty !== undefined) {
				if (parsed.data.specialty === null) {
					updateInput.specialty = null;
				} else {
					const normalized = parsed.data.specialty.trim();
					updateInput.specialty = normalized.length > 0 ? normalized : null;
				}
			}

			if (parsed.data.phone !== undefined) {
				if (parsed.data.phone === null) {
					updateInput.phone = null;
				} else {
					const normalized = parsed.data.phone.trim();
					updateInput.phone = normalized.length > 0 ? normalized : null;
				}
			}

			if (parsed.data.avatarDataUrl !== undefined) {
				if (parsed.data.avatarDataUrl === null) {
					updateInput.avatarDataUrl = null;
				} else {
					const normalized = parsed.data.avatarDataUrl.trim();
					updateInput.avatarDataUrl = normalized.length > 0 ? normalized : null;
				}
			}

			try {
				const updated = await professionals.updateProfile(updateInput);
				const responseBody = serializeProfessionalProfile({
					id: updated.id,
					name: updated.name,
					email: updated.email,
					documentId: updated.documentId,
					specialty: updated.specialty,
					phone: updated.phone,
					avatarUrl: updated.avatarUrl,
					isActive: updated.isActive,
					mustChangePassword: updated.mustChangePassword,
					roles: updated.roles,
					createdAt: updated.createdAt,
					updatedAt: updated.updatedAt,
				});

				c.set("professional", {
					...professional,
					name: updated.name,
					specialty: updated.specialty ?? null,
					phone: updated.phone ?? null,
					avatarUrl: updated.avatarUrl ?? null,
					isActive: updated.isActive,
					mustChangePassword: updated.mustChangePassword,
					createdAt: updated.createdAt ? new Date(updated.createdAt) : professional.createdAt,
					updatedAt: updated.updatedAt ? new Date(updated.updatedAt) : professional.updatedAt,
				});

				return c.json(responseBody);
			} catch (error) {
				if (error instanceof ProfessionalProfileUpdateError) {
					if (error.code === "INVALID_AVATAR") {
						return c.json(validationError({ avatarDataUrl: "Imagem inválida. Envie uma foto PNG, JPG ou WEBP de até 2MB." }), 400);
					}
					if (error.code === "NOT_FOUND") {
						return c.json(notFound("Profissional não encontrado"), 404);
					}
				}
				throw error;
			}
		});

	router.get("/patients/me", requirePatient, async (c) => {
		const patientSession = c.get("patient");
		if (!patientSession) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}
		const view = await patients.getMobileView(patientSession.id);
		return c.json(view);
	});

		router.get("/patients/me/appointments", requirePatient, async (c) => {
			const parsed = patientAppointmentsQuerySchema.safeParse(c.req.query());
			if (!parsed.success) {
				return c.json(validationError(parsed.error.flatten()), 400);
			}
			const patientSession = c.get("patient");
			if (!patientSession) {
				throw new HTTPException(401, { message: "UNAUTHENTICATED" });
			}
			const appointmentsList = await patients.listUpcomingAppointments(
				patientSession.id,
				parsed.data.limit,
			);
			return c.json({ data: appointmentsList });
		});

		router.post("/patients/me/occurrences", requirePatient, async (c) => {
			let body: unknown;
			try {
				body = await c.req.json();
			} catch (error) {
				return c.json(validationError("JSON inválido"), 400);
			}
			const parsed = patientOccurrenceCreateSchema.safeParse(body);
			if (!parsed.success) {
				return c.json(validationError(parsed.error.flatten()), 400);
			}
			const patientSession = c.get("patient");
			if (!patientSession) {
				throw new HTTPException(401, { message: "UNAUTHENTICATED" });
			}
			const [nextAppointment] = await patients.listUpcomingAppointments(patientSession.id, 1);
			let professionalId = nextAppointment?.professional?.id ?? nextAppointment?.professionalId;
			if (!professionalId) {
				const fallbackRaw = process.env.PATIENT_OCCURRENCE_FALLBACK_PROFESSIONAL_ID;
				if (fallbackRaw) {
					const parsedId = Number(fallbackRaw);
					if (Number.isInteger(parsedId) && parsedId > 0) {
						professionalId = parsedId;
					}
				}
			}
			if (!professionalId) {
				return c.json(
					{
						code: "PROFESSIONAL_NOT_FOUND",
						message: "Não foi possível identificar um profissional responsável para este paciente.",
					},
					409,
				);
			}
			const occurrence = await occurrences.createOccurrence(
				patientSession.id,
				{
					kind: parsed.data.kind,
					intensity: parsed.data.intensity,
					source: "patient",
					notes: normalizeNullableString(parsed.data.notes),
				},
				{ professionalId },
			);
			return c.json(occurrence, 201);
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
		return c.json(serializePatientDetail(detail));
	});

	router.put("/patients/:id", requireProfessional, async (c) => {
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

		const parsed = patientUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(validationError(parsed.error.flatten()), 400);
		}

		const data = parsed.data;
		const updateInput: PatientUpdateInput = {};

		if (data.fullName !== undefined) {
			updateInput.fullName = data.fullName.trim();
		}

		if (data.birthDate !== undefined) {
			if (data.birthDate === null || data.birthDate.trim().length === 0) {
				updateInput.birthDate = null;
			} else {
				const normalizedBirth = data.birthDate.trim();
				if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedBirth)) {
					return c.json(validationError({ birthDate: "Data inválida" }), 400);
				}
				const birthDate = new Date(`${normalizedBirth}T00:00:00.000Z`);
				if (Number.isNaN(birthDate.getTime())) {
					return c.json(validationError({ birthDate: "Data inválida" }), 400);
				}
				updateInput.birthDate = birthDate;
			}
		}

		if (data.phone !== undefined) {
			updateInput.phone = normalizeNullableString(data.phone ?? undefined);
		}

		if (data.emergencyPhone !== undefined) {
			updateInput.emergencyPhone = normalizeNullableString(data.emergencyPhone ?? undefined);
		}

		if (data.tumorType !== undefined) {
			updateInput.tumorType = normalizeNullableString(data.tumorType ?? undefined);
		}

		if (data.clinicalUnit !== undefined) {
			updateInput.clinicalUnit = normalizeNullableString(data.clinicalUnit ?? undefined);
		}

		if (data.stage !== undefined) {
			updateInput.stage = data.stage;
		}

		if (data.status !== undefined) {
			updateInput.status = data.status;
		}

		if (data.audioMaterialUrl !== undefined) {
			if (data.audioMaterialUrl === null) {
				updateInput.audioMaterialUrl = null;
			} else {
				const normalizedUrl = normalizeNullableString(data.audioMaterialUrl);
				updateInput.audioMaterialUrl = normalizedUrl;
			}
		}

		if (Object.keys(updateInput).length === 0) {
			return c.json(validationError("Nenhuma alteração informada"), 400);
		}

		const professional = c.get("professional");
		if (!professional) {
			throw new HTTPException(401, { message: "UNAUTHENTICATED" });
		}

		const updated = await patientManagement.updatePatient(idParam, updateInput, {
			professionalId: professional.id,
		});
		if (!updated) {
			return c.json(notFound("Paciente não encontrado"), 404);
		}

		return c.json(serializePatientEntity(updated));
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
	reportsRouter.get("/adherence", async (c) => {
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
		const report = await reports.getAdherenceReport({
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
