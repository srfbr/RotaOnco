import { apiClient } from "@/lib/api-client";
import type { components } from "@/lib/api-schema";

export type WaitTimesReport = components["schemas"]["WaitTimesReport"];
export type AttendanceReport = components["schemas"]["AttendanceReport"];
export type AdherenceReport = components["schemas"]["AdherenceReport"];
export type AlertsReport = components["schemas"]["AlertsReport"];

export type ReportRange = {
	start: string;
	end: string;
};

function toQueryParams(range: ReportRange) {
	return {
		query: {
			start: range.start,
			end: range.end,
		},
	};
}

export async function fetchWaitTimesReport(range: ReportRange) {
	const { data, error } = await apiClient.GET("/reports/wait-times", {
		params: toQueryParams(range),
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}

export async function fetchAttendanceReport(range: ReportRange) {
	const { data, error } = await apiClient.GET("/reports/attendance", {
		params: toQueryParams(range),
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}

export async function fetchAdherenceReport(range: ReportRange) {
	const { data, error } = await apiClient.GET("/reports/adherence", {
		params: toQueryParams(range),
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}

export async function fetchAlertsReport(range: ReportRange) {
	const { data, error } = await apiClient.GET("/reports/alerts", {
		params: toQueryParams(range),
	});
	if (error) {
		throw error;
	}
	return data ?? null;
}
