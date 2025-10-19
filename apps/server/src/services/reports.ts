import type { AppointmentEntity } from "./appointments";

export type AttendanceReportInput = {
	professionalId: number;
	start: Date;
	end: Date;
};

export type WaitTimesReportInput = AttendanceReportInput;

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
	"status" | "startsAt" | "createdAt" | "type"
>;

export interface ReportsRepository {
	fetchAppointments(
		params: AttendanceReportInput,
	): Promise<ReportsAppointmentRow[]>;
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
	};
}

export type ReportsService = ReturnType<typeof createReportsService>;
