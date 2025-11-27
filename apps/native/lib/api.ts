import { authClient } from "./auth-client";
import { getPatientSessionCookie, setPatientSessionCookie, clearPatientSessionCookie } from "./patient-session";

const rawBaseUrl = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://localhost:3000";
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const API_BASE_URL = `${normalizedBaseUrl}/api`;

type ApiRequestInit = Omit<RequestInit, "body"> & {
	body?: BodyInit | null | Record<string, unknown>;
};

export type ApiErrorResponse = {
	code?: string;
	message?: string;
	details?: unknown;
};

export class ApiError extends Error {
	status: number;
	response?: ApiErrorResponse | null;

	constructor(message: string, status: number, response?: ApiErrorResponse | null) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.response = response;
	}
}

async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
	const url = `${API_BASE_URL}${path}`;
	const headers = new Headers(init?.headers ?? {});

	if (!headers.has("Accept")) {
		headers.set("Accept", "application/json");
	}

	const rawBody = init?.body ?? undefined;
	const isJsonBody =
		rawBody !== undefined &&
		rawBody !== null &&
		typeof rawBody === "object" &&
		!(rawBody instanceof FormData) &&
		!(rawBody instanceof Blob);
	const body = isJsonBody ? JSON.stringify(rawBody) : (rawBody as BodyInit | undefined);

	if (isJsonBody && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const cookie = typeof authClient.getCookie === "function" ? authClient.getCookie() : undefined;
	const patientSessionCookie = await getPatientSessionCookie();
	const cookieParts: string[] = [];
	const existingCookieHeader = headers.get("Cookie");
	if (existingCookieHeader) {
		cookieParts.push(existingCookieHeader);
	}
	if (cookie) {
		cookieParts.push(cookie);
	}
	if (patientSessionCookie) {
		cookieParts.push(patientSessionCookie);
	}
	if (cookieParts.length > 0) {
		headers.set("Cookie", cookieParts.join("; "));
	}

	let response: Response;

	try {
		response = await fetch(url, {
			...init,
			headers,
			body,
			credentials: "omit",
		});
	} catch (error) {
		throw new ApiError(
			error instanceof Error ? error.message : "Não foi possível se conectar ao servidor.",
			0,
			undefined,
		);
	}

	let parsed: T | null = null;

	if (!response.ok) {
		let errorPayload: ApiErrorResponse | null = null;
		try {
			errorPayload = await response.json();
		} catch (error) {
			errorPayload = null;
		}

		throw new ApiError(
			errorPayload?.message ?? `Erro na requisição (${response.status})`,
			response.status,
			errorPayload,
		);
	}

	if (response.status === 204) {
		return null as T;
	}

	const text = await response.text();
	if (!text) {
		return null as T;
	}

	try {
		parsed = JSON.parse(text) as T;
	} catch (error) {
		throw new ApiError("Resposta inválida do servidor.", response.status, null);
	}

	return parsed;
}

function extractPatientSessionCookie(headerValue: string | null): string | null {
	if (!headerValue) {
		return null;
	}

	const match = headerValue.match(/patient_session=[^;]+/i);
	return match ? match[0] : null;
}

export async function loginPatientWithPin(input: { cpf: string; pin: string }) {
	const url = `${API_BASE_URL}/auth/patient-pin`;
	let response: Response;

	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(input),
			credentials: "include",
		});
	} catch (error) {
		throw new ApiError(
			error instanceof Error ? error.message : "Não foi possível se conectar ao servidor.",
			0,
			undefined,
		);
	}

	if (!response.ok) {
		let errorPayload: ApiErrorResponse | null = null;
		try {
			errorPayload = await response.json();
		} catch (error) {
			errorPayload = null;
		}

		throw new ApiError(
			errorPayload?.message ?? `Erro na requisição (${response.status})`,
			response.status,
			errorPayload,
		);
	}

	const setCookieHeader = response.headers.get("set-cookie");
	const patientCookie = extractPatientSessionCookie(setCookieHeader);
	if (patientCookie) {
		await setPatientSessionCookie(patientCookie);
	}

	return null;
}

export async function logoutPatientSession() {
	try {
		await apiFetch<null>("/auth/logout", {
			method: "POST",
		});
	} catch (error) {
		// We still want to clear the local session even if the server call fails.
	}

	await clearPatientSessionCookie();
}

export type AlertSeverity = "low" | "medium" | "high";
export type AlertStatus = "open" | "acknowledged" | "closed";

export type Alert = {
	id: number;
	patientId: number;
	kind: string;
	severity: AlertSeverity;
	status: AlertStatus;
	details: string | null;
	createdAt: string;
	resolvedAt: string | null;
	resolvedBy: number | null;
};

export type PaginatedResponse<T> = {
	data: T[];
	meta: {
		total: number;
		limit: number;
		offset: number;
	};
};

export type ProfessionalProfile = {
	id: number;
	name: string;
	email: string;
	documentId: string;
	specialty: string | null;
	phone: string | null;
	avatarUrl: string | null;
	isActive: boolean;
	roles: string[];
	createdAt: string | null;
	updatedAt: string | null;
};

export async function fetchProfessionalProfile() {
	return apiFetch<ProfessionalProfile>("/professionals/me", {
		method: "GET",
	});
}

export async function updateProfessionalProfile(input: {
	name?: string;
	specialty?: string | null;
	phone?: string | null;
	avatarDataUrl?: string | null;
}) {
	return apiFetch<ProfessionalProfile>("/professionals/me", {
		method: "PATCH",
		body: input,
	});
}

export type PatientStatus = "active" | "inactive" | "at_risk";
export type PatientStage = "pre_triage" | "in_treatment" | "post_treatment";

export type PatientSummary = {
	id: number;
	fullName: string;
	cpf: string;
	stage: PatientStage;
	status: PatientStatus;
};

export type PatientDetail = {
	id: number;
	fullName: string;
	cpf: string;
	birthDate: string | null;
	emergencyPhone: string | null;
	phone: string | null;
	clinicalUnit: string | null;
	tumorType: string | null;
	stage: PatientStage;
	status: PatientStatus;
	audioMaterialUrl: string | null;
	pinAttempts: number;
	pinBlockedUntil: string | null;
	createdAt: string;
	updatedAt: string;
};

export type ProfessionalPatientContact = {
	id: number;
	fullName: string;
	relation: string;
	phone: string | null;
	isPrimary: boolean;
};

export type ProfessionalPatientDetail = PatientDetail & {
	contacts: ProfessionalPatientContact[];
	occurrences: PatientOccurrence[];
	alerts: Alert[];
};

export async function fetchProfessionalAlerts(params?: {
	limit?: number;
	status?: AlertStatus;
	severity?: AlertSeverity;
}) {
	const query = new URLSearchParams();
	if (params?.limit) {
		query.set("limit", String(params.limit));
	}
	if (params?.status) {
		query.set("status", params.status);
	}
	if (params?.severity) {
		query.set("severity", params.severity);
	}

	const suffix = query.toString();
	const path = suffix ? `/alerts?${suffix}` : "/alerts";

	return apiFetch<PaginatedResponse<Alert>>(path, {
		method: "GET",
	});
}

export async function acknowledgeAlert(alertId: number) {
	return apiFetch<Alert>(`/alerts/${alertId}`, {
		method: "PATCH",
		body: {
			status: "acknowledged",
		},
	});
}

export async function fetchPatients(params?: {
	q?: string;
	status?: PatientStatus;
	stage?: PatientStage;
	limit?: number;
	offset?: number;
}) {
	const query = new URLSearchParams();

	if (params?.q) {
		query.set("q", params.q);
	}
	if (params?.status) {
		query.set("status", params.status);
	}
	if (params?.stage) {
		query.set("stage", params.stage);
	}
	if (typeof params?.limit === "number") {
		query.set("limit", String(params.limit));
	}
	if (typeof params?.offset === "number") {
		query.set("offset", String(params.offset));
	}

	const suffix = query.toString();
	const path = suffix ? `/patients?${suffix}` : "/patients";

	return apiFetch<PaginatedResponse<PatientSummary>>(path, {
		method: "GET",
	});
}

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "no_show" | "canceled";
export type AppointmentType = "triage" | "treatment" | "return";

export type Appointment = {
	id: number;
	patientId: number;
	professionalId: number;
	startsAt: string;
	type: AppointmentType;
	status: AppointmentStatus;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
};

export type AppointmentProfessional = {
	id: number;
	name: string;
	specialty: string | null;
	avatarUrl: string | null;
};

export type PatientAppointment = Appointment & {
	professional: AppointmentProfessional | null;
};

export type PatientOccurrenceSource = "patient" | "professional";

export type PatientOccurrence = {
	id: number;
	patientId: number;
	professionalId: number;
	kind: string;
	intensity: number;
	source: PatientOccurrenceSource;
	notes: string | null;
	createdAt: string;
};

type PatientDetailResponse = PatientSummary & {
	birthDate: string | null;
	emergencyPhone: string | null;
	phone: string | null;
	clinicalUnit: string | null;
	tumorType: string | null;
	contacts: unknown[];
	occurrences: unknown[];
	alerts: unknown[];
};

export async function fetchPatientSummaryById(id: number): Promise<PatientSummary | null> {
	try {
		const patient = await apiFetch<PatientDetailResponse>(`/patients/${id}`, {
			method: "GET",
		});
		return {
			id: patient.id,
			fullName: patient.fullName,
			cpf: patient.cpf,
			stage: patient.stage,
			status: patient.status,
		};
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			return null;
		}
		throw error;
	}
}

export async function fetchProfessionalPatientDetail(id: number): Promise<ProfessionalPatientDetail | null> {
	try {
		return await apiFetch<ProfessionalPatientDetail>(`/patients/${id}`, {
			method: "GET",
		});
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			return null;
		}
		throw error;
	}
}

export type AppointmentListItem = Appointment & {
	patient?: PatientSummary | null;
};

export async function searchPatients(query: string, limit = 5) {
	const params = new URLSearchParams();
	params.set("q", query);
	params.set("limit", String(limit));
	return apiFetch<PatientSummary[]>(`/patients/search?${params.toString()}`, {
		method: "GET",
	});
}

export type PatientAudioMaterial = {
	title: string;
	url: string;
};

export type PatientMobileView = {
	patient: PatientDetail;
	nextAppointments: PatientAppointment[];
	audioMaterials: PatientAudioMaterial[];
};

export async function fetchPatientHome() {
	return apiFetch<PatientMobileView>("/patients/me", {
		method: "GET",
	});
}

export type PatientAppointmentsResponse = {
	data: PatientAppointment[];
};

export async function fetchPatientAppointments(params?: { limit?: number }) {
	const query = new URLSearchParams();
	if (typeof params?.limit === "number") {
		query.set("limit", String(params.limit));
	}
	const suffix = query.toString();
	const path = suffix ? `/patients/me/appointments?${suffix}` : "/patients/me/appointments";
	const response = await apiFetch<PatientAppointmentsResponse>(path, {
		method: "GET",
	});
	return response.data ?? [];
}

export async function reportPatientOccurrence(input: {
	kind: string;
	intensity: number;
	notes?: string | null;
}) {
	return apiFetch<PatientOccurrence>("/patients/me/occurrences", {
		method: "POST",
		body: {
			kind: input.kind,
			intensity: input.intensity,
			notes: input.notes ?? undefined,
		},
	});
}

export async function fetchProfessionalAppointments(params?: {
	day?: string;
	status?: AppointmentStatus;
	limit?: number;
	offset?: number;
	includePatients?: boolean;
}) {
	const query = new URLSearchParams();
	if (params?.day) {
		query.set("day", params.day);
	}
	if (params?.status) {
		query.set("status", params.status);
	}
	if (typeof params?.limit === "number") {
		query.set("limit", String(params.limit));
	}
	if (typeof params?.offset === "number") {
		query.set("offset", String(params.offset));
	}

	const suffix = query.toString();
	const path = suffix ? `/appointments?${suffix}` : "/appointments";

	const response = await apiFetch<PaginatedResponse<Appointment>>(path, {
		method: "GET",
	});

	const data = response.data ?? [];
	const meta = response.meta ?? {
		total: data.length,
		limit: params?.limit ?? data.length,
		offset: params?.offset ?? 0,
	};

	if (params?.includePatients === false || data.length === 0) {
		const sorted = [...data].sort((a, b) => {
			const left = new Date(a.startsAt).getTime();
			const right = new Date(b.startsAt).getTime();
			if (Number.isNaN(left) || Number.isNaN(right)) {
				return 0;
			}
			return left - right;
		});
		return {
			data: sorted as AppointmentListItem[],
			meta,
		};
	}

	const uniquePatientIds = Array.from(new Set(data.map((item) => item.patientId).filter(Boolean)));
	const patientSummaries = new Map<number, PatientSummary | null>();

	if (uniquePatientIds.length > 0) {
		const results = await Promise.allSettled(
			uniquePatientIds.map(async (id) => ({
				id,
				summary: await fetchPatientSummaryById(id),
			})),
		);

		for (const result of results) {
			if (result.status === "fulfilled") {
				patientSummaries.set(result.value.id, result.value.summary ?? null);
			}
		}
	}

	const enriched = data
		.map<AppointmentListItem>((appointment) => ({
			...appointment,
			patient: appointment.patientId ? patientSummaries.get(appointment.patientId) ?? null : null,
		}))
		.sort((a, b) => {
			const left = new Date(a.startsAt).getTime();
			const right = new Date(b.startsAt).getTime();
			if (Number.isNaN(left) || Number.isNaN(right)) {
				return 0;
			}
			return left - right;
		});

	return {
		data: enriched,
		meta,
	};
}

export async function createAppointment(input: {
	patientId: number;
	startsAt: string;
	type: AppointmentType;
	notes?: string | null;
}) {
	return apiFetch<Appointment>("/appointments", {
		method: "POST",
		body: input,
	});
}

export async function updateAppointment(
	id: number,
	input: { startsAt?: string; type?: AppointmentType; notes?: string | null },
) {
	return apiFetch<Appointment>(`/appointments/${id}`, {
		method: "PUT",
		body: input,
	});
}

export async function updateAppointmentStatus(
	id: number,
	input: { status: AppointmentStatus; notes?: string | null },
) {
	return apiFetch<void>(`/appointments/${id}/status`, {
		method: "POST",
		body: input,
	});
}

export async function confirmPatientAppointment(appointmentId: number) {
	return apiFetch<void>(`/appointments/${appointmentId}/confirm`, {
		method: "POST",
	});
}

export async function declinePatientAppointment(appointmentId: number, input?: { reason?: string }) {
	return apiFetch<void>(`/appointments/${appointmentId}/decline`, {
		method: "POST",
		body: input ?? {},
	});
}
