import { apiClient } from "@/lib/api-client";
import type { components } from "@/lib/api-schema";
import type { TeamMemberStatus } from "./data";

export type ProfessionalDirectoryParameters = {
	query?: string;
	status?: TeamMemberStatus;
	limit?: number;
	offset?: number;
	includeSummary?: boolean;
};

export type ProfessionalDirectoryResponse = components["schemas"]["PaginatedUsers"];
export type ProfessionalCreateInput = components["schemas"]["ProfessionalCreateInput"];
export type Professional = components["schemas"]["User"];

export async function fetchProfessionals(params: ProfessionalDirectoryParameters = {}) {
	const { query, status, limit, offset, includeSummary = true } = params;

	const { data, error } = await apiClient.GET("/professionals", {
		params: {
			query: {
				q: query?.trim() ? query.trim() : undefined,
				status,
				limit,
				offset,
				includeSummary,
			},
		},
	});

	if (error) {
		throw error;
	}

	const fallback: ProfessionalDirectoryResponse = {
		data: [],
		meta: {
			total: 0,
			limit: limit ?? 0,
			offset: offset ?? 0,
			statusCounts: includeSummary
				? {
					total: 0,
					active: 0,
					inactive: 0,
				}
				: undefined,
		},
	};

	return data ?? fallback;
}

export async function createProfessional(input: ProfessionalCreateInput): Promise<Professional> {
	const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2);

	const { data, error } = await apiClient.POST("/professionals", {
		headers: {
			"Idempotency-Key": idempotencyKey,
		},
		body: input,
	});

	if (error) {
		throw new Error(resolveProfessionalErrorMessage(error));
	}

	if (!data) {
		throw new Error("Falha ao cadastrar profissional");
	}

	return data;
}

export async function deleteProfessional(userId: number): Promise<void> {
	const { error } = await apiClient.DELETE("/professionals/{id}", {
		params: {
			path: {
				id: userId,
			},
		},
	});

	if (error) {
		throw new Error(resolveProfessionalErrorMessage(error));
	}
}

function resolveProfessionalErrorMessage(error: unknown) {
	const defaultMessage = "Não foi possível cadastrar o profissional.";
	if (!error || typeof error !== "object") {
		return defaultMessage;
	}
	const maybeError = error as {
		message?: string;
		error?: unknown;
		data?: unknown;
	};

	if (typeof maybeError.message === "string" && maybeError.message.trim().length > 0) {
		return maybeError.message;
	}

	const nestedMessage = extractMessage(maybeError.error) ?? extractMessage(maybeError.data);
	return nestedMessage ?? defaultMessage;
}

function extractMessage(payload: unknown): string | null {
	if (!payload) {
		return null;
	}
	if (typeof payload === "string" && payload.trim().length > 0) {
		return payload.trim();
	}
	if (payload instanceof Error) {
		return payload.message;
	}
	if (typeof payload === "object") {
		const maybe = payload as { message?: unknown; detail?: unknown; code?: unknown; error?: unknown };
		if (typeof maybe.message === "string" && maybe.message.trim().length > 0) {
			return maybe.message.trim();
		}
		if (typeof maybe.detail === "string" && maybe.detail.trim().length > 0) {
			return maybe.detail.trim();
		}
		return extractMessage(maybe.error) ?? null;
	}
	return null;
}
