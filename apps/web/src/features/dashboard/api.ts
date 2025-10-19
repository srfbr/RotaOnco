import { apiClient } from "@/lib/api-client";
import type { components } from "@/lib/api-schema";

export type PatientSummary = components["schemas"]["PatientSummary"];
export type Alert = components["schemas"]["Alert"];
export type AttendanceReport = components["schemas"]["AttendanceReport"];
export type WaitTimesReport = components["schemas"]["WaitTimesReport"];
export type PaginatedMeta = components["schemas"]["PaginationMeta"];

export function formatDate(date: Date) {
	return date.toISOString().slice(0, 10);
}

export function subDays(date: Date, days: number) {
	const newDate = new Date(date);
	newDate.setDate(date.getDate() - days);
	return newDate;
}

export async function fetchPatients(limit: number) {
	const { data, error } = await apiClient.GET("/patients", {
		params: { query: { limit } },
	});
	if (error) {
		throw error;
	}
	return data ?? { data: [], meta: { total: 0, limit, offset: 0 } };
}

export async function fetchPatientCountByStatus(status: "active" | "inactive" | "at_risk") {
	const { data, error } = await apiClient.GET("/patients", {
		params: { query: { status, limit: 1 } },
	});
	if (error) {
		throw error;
	}
	return data?.meta?.total ?? 0;
}

export async function fetchAttendanceMetrics(start: string, end: string) {
	const { data, error } = await apiClient.GET("/reports/attendance", {
		params: { query: { start, end } },
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}

export async function fetchWaitTimesMetrics(start: string, end: string) {
	const { data, error } = await apiClient.GET("/reports/wait-times", {
		params: { query: { start, end } },
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}

export async function fetchAlerts(limit: number) {
	const { data, error } = await apiClient.GET("/alerts", {
		params: { query: { limit, status: "open" } },
	});
	if (error) {
		throw error;
	}
	return data ?? { data: [], meta: { total: 0, limit, offset: 0 } };
}

export async function acknowledgeAlert(alertId: number) {
	const { data, error } = await apiClient.PATCH("/alerts/{id}", {
		params: { path: { id: alertId } },
		body: { status: "acknowledged" as const },
	});
	if (error) {
		throw error;
	}
	return data;
}

export async function fetchAppointmentsByPatient(patientId: number, limit = 10) {
	const { data, error } = await apiClient.GET("/appointments", {
		params: { query: { patientId, limit } },
	});
	if (error) {
		throw error;
	}
	return data ?? { data: [], meta: { total: 0, limit, offset: 0 } };
}

export async function fetchTodayAppointmentsCount(day: string) {
	const { data, error } = await apiClient.GET("/appointments", {
		params: { query: { day, limit: 1 } },
	});
	if (error) {
		throw error;
	}
	return data?.meta?.total ?? 0;
}

export async function fetchCriticalAlertCount() {
	const { data, error } = await apiClient.GET("/alerts", {
		params: { query: { severity: "high", status: "open", limit: 1 } },
	});
	if (error) {
		throw error;
	}
	return data?.meta?.total ?? 0;
}
