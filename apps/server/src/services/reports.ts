import type { AppointmentEntity } from "./appointments";

export type AttendanceReportInput = {
	professionalId: number;
	start: Date;
	end: Date;
};

export type WaitTimesReportInput = AttendanceReportInput;

export type AlertsReportInput = AttendanceReportInput;

export type AttendanceReport = {
	period: {
		start: string;
		end: string;
	};
	totals: {
		scheduled: number;
		confirmed: number;
		completed: number;
		noShow: number;
		cancellationRate: number;
	};
};

export type WaitTimesReport = {
	averageDaysToTriage: number;
	averageDaysToTreatment: number;
	medianQueueTime: number;
};

export type ReportsAppointmentRow = Pick<
	AppointmentEntity,
	"status" | "startsAt" | "createdAt" | "type" | "patientId"
>;

export type ReportsOccurrenceRow = {
	patientId: number;
	source: "patient" | "professional";
	createdAt: Date;
};

type AlertSeverity = "low" | "medium" | "high";
type AlertStatus = "open" | "acknowledged" | "closed";

export type ReportsAlertRow = {
	id: number;
	patientId: number;
	kind: string;
	severity: AlertSeverity;
	status: AlertStatus;
	createdAt: Date;
};

export type AlertsReport = {
	period: {
		start: string;
		end: string;
	};
	totals: {
		status: Record<AlertStatus, number>;
		severity: Record<AlertSeverity, number>;
	};
	recent: Array<{
		id: number;
		patientId: number;
		kind: string;
		severity: AlertSeverity;
		status: AlertStatus;
		createdAt: string;
	}>;
};

export type AdherenceReport = {
	period: {
		start: string;
		end: string;
	};
	totals: {
		completedAppointments: number;
		symptomReportCount: number;
	};
	patients: {
		withCompletedAppointments: number;
		reportingSymptoms: number;
		engaged: number;
		engagementRate: number;
	};
};

export interface ReportsRepository {
	fetchAppointments(
		params: AttendanceReportInput,
	): Promise<ReportsAppointmentRow[]>;
	fetchOccurrences(
		params: AttendanceReportInput,
	): Promise<ReportsOccurrenceRow[]>;
	fetchAlerts(params: AlertsReportInput): Promise<ReportsAlertRow[]>;
}

function formatDate(date: Date) {
	return date.toISOString().slice(0, 10);
}

function average(values: number[]) {
	if (values.length === 0) {
		return 0;
	}
	const total = values.reduce((sum, value) => sum + value, 0);
	return total / values.length;
}

function median(values: number[]) {
	if (values.length === 0) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1] + sorted[mid]) / 2;
	}
	return sorted[mid];
}

function computeLeadTimesInDays(rows: ReportsAppointmentRow[]) {
	return rows.map((row) => {
		const diffMs = row.startsAt.getTime() - row.createdAt.getTime();
		const days = diffMs / (1000 * 60 * 60 * 24);
		return Number.isFinite(days) ? Math.max(0, days) : 0;
	});
}

export function createReportsService(repo: ReportsRepository) {
	return {
		async getAttendanceReport(params: AttendanceReportInput): Promise<AttendanceReport> {
			const rows = await repo.fetchAppointments(params);
			const totals = {
				scheduled: 0,
				confirmed: 0,
				completed: 0,
				noShow: 0,
				canceled: 0,
			};
			for (const row of rows) {
				switch (row.status) {
					case "scheduled":
						totals.scheduled += 1;
						break;
					case "confirmed":
						totals.confirmed += 1;
						break;
					case "completed":
						totals.completed += 1;
						break;
					case "no_show":
						totals.noShow += 1;
						break;
					case "canceled":
						totals.canceled += 1;
						break;
				}
			}
			const totalEvaluated =
				totals.scheduled +
				totals.confirmed +
				totals.completed +
				totals.noShow +
				totals.canceled;
			const cancellationRate = totalEvaluated > 0 ? totals.canceled / totalEvaluated : 0;

			return {
				period: {
					start: formatDate(params.start),
					end: formatDate(params.end),
				},
				totals: {
					scheduled: totals.scheduled,
					confirmed: totals.confirmed,
					completed: totals.completed,
					noShow: totals.noShow,
					cancellationRate,
				},
			};
		},

		async getWaitTimesReport(params: WaitTimesReportInput): Promise<WaitTimesReport> {
			const rows = await repo.fetchAppointments(params);
			const triageRows = rows.filter((row) => row.type === "triage");
			const treatmentRows = rows.filter((row) => row.type === "treatment");
			const triageLeadTimes = computeLeadTimesInDays(triageRows);
			const treatmentLeadTimes = computeLeadTimesInDays(treatmentRows);
			const allLeadTimes = computeLeadTimesInDays(rows);

			return {
				averageDaysToTriage: average(triageLeadTimes),
				averageDaysToTreatment: average(treatmentLeadTimes),
				medianQueueTime: median(allLeadTimes),
			};
		},

		async getAdherenceReport(params: AttendanceReportInput): Promise<AdherenceReport> {
			const [appointmentsRows, occurrenceRows] = await Promise.all([
				repo.fetchAppointments(params),
				repo.fetchOccurrences(params),
			]);

			const completedAppointments = appointmentsRows.filter((row) => row.status === "completed");
			const completedPatientIds = new Set(completedAppointments.map((row) => row.patientId));
			const totalCompletedAppointments = completedAppointments.length;

			const patientOccurrences = occurrenceRows.filter((row) => row.source === "patient");
			const symptomPatientIds = new Set(patientOccurrences.map((row) => row.patientId));
			const totalSymptomReports = patientOccurrences.length;

			let engagedPatients = 0;
			for (const patientId of symptomPatientIds) {
				if (completedPatientIds.has(patientId)) {
					engagedPatients += 1;
				}
			}

			const withCompletedAppointments = completedPatientIds.size;
			const reportingSymptoms = symptomPatientIds.size;
			const engagementRate = withCompletedAppointments > 0
				? engagedPatients / withCompletedAppointments
				: 0;

			return {
				period: {
					start: formatDate(params.start),
					end: formatDate(params.end),
				},
				totals: {
					completedAppointments: totalCompletedAppointments,
					symptomReportCount: totalSymptomReports,
				},
				patients: {
					withCompletedAppointments,
					reportingSymptoms,
					engaged: engagedPatients,
					engagementRate,
				},
			};
		},

		async getAlertsReport(params: AlertsReportInput): Promise<AlertsReport> {
			const alertRows = await repo.fetchAlerts(params);

			const statusTotals: Record<AlertStatus, number> = {
				open: 0,
				acknowledged: 0,
				closed: 0,
			};
			const severityTotals: Record<AlertSeverity, number> = {
				low: 0,
				medium: 0,
				high: 0,
			};

			for (const alert of alertRows) {
				statusTotals[alert.status] += 1;
				severityTotals[alert.severity] += 1;
			}

			const recent = [...alertRows]
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
				.slice(0, 5)
				.map((row) => ({
					id: row.id,
					patientId: row.patientId,
					kind: row.kind,
					severity: row.severity,
					status: row.status,
					createdAt: row.createdAt.toISOString(),
				}));

			return {
				period: {
					start: formatDate(params.start),
					end: formatDate(params.end),
				},
				totals: {
					status: statusTotals,
					severity: severityTotals,
				},
				recent,
			};
		},
	};
}

export type ReportsService = ReturnType<typeof createReportsService>;
