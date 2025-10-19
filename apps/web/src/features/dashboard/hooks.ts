import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	acknowledgeAlert,
	fetchAlerts,
	fetchAttendanceMetrics,
	fetchCriticalAlertCount,
	fetchPatientCountByStatus,
	fetchPatients,
	fetchTodayAppointmentsCount,
	fetchWaitTimesMetrics,
	fetchAppointmentsByPatient,
	formatDate,
	subDays,
} from "./api";
import type { Alert, AttendanceReport, PatientSummary, WaitTimesReport } from "./api";

export type DashboardStats = {
	totalPatients: number;
	consultationsLast30Days: number;
	presenceRate: number | null;
	averageWaitTime: number | null;
	attendanceReport: AttendanceReport | null;
	waitTimesReport: WaitTimesReport | null;
};

export type DashboardPatient = PatientSummary & {
	lastAppointment?: string | null;
	nextAppointment?: string | null;
};

export type DashboardAlert = Alert;

const DASHBOARD_SCOPE = "dashboard";

export function useDashboardStats() {
	return useQuery<DashboardStats>({
		queryKey: [DASHBOARD_SCOPE, "stats"],
		queryFn: async () => {
			const today = new Date();
			const start = formatDate(subDays(today, 29));
			const end = formatDate(today);

			const [patientsResponse, attendance, waitTimes] = await Promise.all([
				fetchPatients(1),
				fetchAttendanceMetrics(start, end),
				fetchWaitTimesMetrics(start, end),
			]);

			const totalPatients = patientsResponse.meta?.total ?? 0;
			const consultationsLast30Days = attendance?.totals?.completed ?? 0;
			const scheduled = attendance?.totals?.scheduled ?? 0;
			const completed = attendance?.totals?.completed ?? 0;
			const presenceRate = scheduled ? completed / scheduled : null;
			const averageWaitTime = waitTimes?.averageDaysToTreatment ?? null;

			return {
				totalPatients,
				consultationsLast30Days,
				presenceRate,
				averageWaitTime,
				attendanceReport: attendance,
				waitTimesReport: waitTimes,
			};
		},
		staleTime: 60 * 1000,
	});
}

export function useDashboardPatients(limit = 4) {
	return useQuery<DashboardPatient[]>({
		queryKey: [DASHBOARD_SCOPE, "patients", limit],
		queryFn: async () => {
			const response = await fetchPatients(limit);
			const patients = response.data ?? [];
			const enriched = await Promise.all(
				patients.map(async (patient) => {
					const appointmentsResponse = await fetchAppointmentsByPatient(patient.id, 20);
					const appointments = appointmentsResponse.data ?? [];
					const now = new Date();
					const past: Date[] = [];
					const future: Date[] = [];

					for (const appointment of appointments) {
						const startsAtStr = appointment.startsAt as string;
						if (!startsAtStr) continue;
						const startsAt = new Date(startsAtStr);
						if (Number.isNaN(startsAt.getTime())) continue;
						if (startsAt <= now) {
							past.push(startsAt);
						} else {
							future.push(startsAt);
						}
					}

					past.sort((a, b) => b.getTime() - a.getTime());
					future.sort((a, b) => a.getTime() - b.getTime());

					const lastAppointment = past[0]?.toISOString() ?? null;
					const nextAppointment = future[0]?.toISOString() ?? null;

					return {
						...patient,
						lastAppointment,
						nextAppointment,
					};
				}),
			);

			return enriched;
		},
		staleTime: 60 * 1000,
	});
}

export function useDashboardAlerts(limit = 5) {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: [DASHBOARD_SCOPE, "alerts", limit],
		queryFn: async () => {
			const response = await fetchAlerts(limit);
			return response.data ?? [];
		},
		staleTime: 30 * 1000,
	});

	const mutation = useMutation({
		mutationFn: acknowledgeAlert,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [DASHBOARD_SCOPE, "alerts"] });
			queryClient.invalidateQueries({ queryKey: [DASHBOARD_SCOPE, "summary"] });
		},
	});

	return {
		...query,
		acknowledgeAlert: mutation.mutateAsync,
		isAcknowledging: mutation.isPending,
	};
}

export function useDashboardSummary() {
	return useQuery({
		queryKey: [DASHBOARD_SCOPE, "summary"],
		queryFn: async () => {
			const today = formatDate(new Date());
			const [activePatients, todayAppointments, criticalAlerts] = await Promise.all([
				fetchPatientCountByStatus("active"),
				fetchTodayAppointmentsCount(today),
				fetchCriticalAlertCount(),
			]);

			return {
				activePatients,
				todayAppointments,
				criticalAlerts,
			};
		},
		staleTime: 30 * 1000,
	});
}
