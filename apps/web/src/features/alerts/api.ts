import { apiClient } from "@/lib/api-client";
import type { components } from "@/lib/api-schema";

export type Alert = components["schemas"]["Alert"];

export async function fetchAlertById(alertId: number) {
	const { data, error } = await apiClient.GET("/alerts/{id}", {
		params: { path: { id: alertId } },
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}
