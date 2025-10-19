import createClient from "openapi-fetch";
import type { paths } from "./api-schema";

const rawBaseUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const baseUrl = normalizedBaseUrl.endsWith("/api")
	? normalizedBaseUrl
	: `${normalizedBaseUrl}/api`;

export const apiClient = createClient<paths>({
	baseUrl,
	fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
		return fetch(input, {
			...init,
			credentials: "include",
			headers: {
				...(init?.headers instanceof Headers
					? Object.fromEntries(init.headers.entries())
					: init?.headers ?? {}),
			},
		});
	},
});

export type ApiClient = typeof apiClient;
