import { useQuery } from "@tanstack/react-query";
import {
	fetchAdherenceReport,
	fetchAttendanceReport,
	fetchWaitTimesReport,
		fetchAlertsReport,
	type ReportRange,
	type AttendanceReport,
	type WaitTimesReport,
	type AdherenceReport,
		type AlertsReport,
} from "./api";

const REPORTS_SCOPE = "reports";

function createQueryKey(kind: string, range: ReportRange) {
	return [REPORTS_SCOPE, kind, range.start, range.end] as const;
}

export function useWaitTimesReport(range: ReportRange) {
	return useQuery<WaitTimesReport | null>({
		queryKey: createQueryKey("wait-times", range),
		queryFn: async () => fetchWaitTimesReport(range),
		staleTime: 60 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}

export function useAttendanceReport(range: ReportRange) {
	return useQuery<AttendanceReport | null>({
		queryKey: createQueryKey("attendance", range),
		queryFn: async () => fetchAttendanceReport(range),
		staleTime: 60 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}

export function useAdherenceReport(range: ReportRange) {
	return useQuery<AdherenceReport | null>({
		queryKey: createQueryKey("adherence", range),
		queryFn: async () => fetchAdherenceReport(range),
		staleTime: 60 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}

export function useAlertsReport(range: ReportRange) {
	return useQuery<AlertsReport | null>({
		queryKey: createQueryKey("alerts", range),
		queryFn: async () => fetchAlertsReport(range),
		staleTime: 60 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}
