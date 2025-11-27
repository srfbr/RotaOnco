import { useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { ReportsActionsPanel } from "@/features/reports/components/reports-actions-panel";
import { ReportsHero } from "@/features/reports/components/reports-hero";
import { ReportsWaitTimeCard } from "@/features/reports/components/reports-wait-time-card";
import { ReportsAbsenceCard } from "@/features/reports/components/reports-absence-card";
import { ReportsAdherenceCard } from "@/features/reports/components/reports-adherence-card";
import { ReportsAlertsCard } from "@/features/reports/components/reports-alerts-card";
import type { ReportRange } from "@/features/reports/api";
import { REPORT_ACTION_GROUPS, type ReportKind } from "@/features/reports/data";
import { createFileRoute } from "@tanstack/react-router";
import { requireActiveProfessional } from "@/lib/route-guards";

export const Route = createFileRoute("/reports")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	component: ReportsRoute,
});

type RangeOption = {
	id: "7d" | "30d" | "90d";
	label: string;
	days: number;
};

const RANGE_OPTIONS: RangeOption[] = [
	{ id: "7d", label: "Últimos 7 dias", days: 7 },
	{ id: "30d", label: "Últimos 30 dias", days: 30 },
	{ id: "90d", label: "Últimos 90 dias", days: 90 },
];

function ReportsRoute() {
	const [activeRangeId, setActiveRangeId] = useState<RangeOption["id"]>("30d");
	const [selectedReport, setSelectedReport] = useState<ReportKind>("adherence");
	const range = useMemo(() => createRangeFromPreset(activeRangeId), [activeRangeId]);

	return (
		<AppLayout>
			<div className="space-y-8">
				<header className="space-y-1">
					<h1 className="text-2xl font-bold text-[#3B3D3B] md:text-[34px] md:leading-[42px]">
						Relatórios
					</h1>
					<p className="text-sm text-[#6E726E]">
						Painéis analíticos para monitorar tempos de espera, presença e adesão.
					</p>
				</header>

				<ReportsHero totalReports={REPORT_ACTION_GROUPS.length} />

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
					<div className="flex min-h-0 flex-col gap-6">
						<section className="flex flex-col gap-4 rounded-xl border border-[#E5E5E5] bg-white p-4 text-sm text-[#3B3D3B]">
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">Período</span>
								<div className="flex flex-wrap gap-2">
									{RANGE_OPTIONS.map((option) => (
										<Button
											key={option.id}
											type="button"
											variant={option.id === activeRangeId ? "default" : "outline"}
											className={
												option.id === activeRangeId
													? "gap-2 bg-[#3663D8] text-white hover:bg-[#2D52B1]"
													: "gap-2 border-[#CBD5F5] text-[#3663D8] hover:bg-[#F3F6FD]"
											}
											onClick={() => setActiveRangeId(option.id)}
										>
											{option.label}
										</Button>
										))}
								</div>
							</div>
							<p className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">
								{formatDisplayRange(range)}
							</p>
						</section>
						{selectedReport === "adherence" && <ReportsAdherenceCard range={range} />}
						{selectedReport === "attendance" && <ReportsAbsenceCard range={range} />}
						{selectedReport === "wait-times" && <ReportsWaitTimeCard range={range} />}
						{selectedReport === "alerts" && <ReportsAlertsCard range={range} />}
					</div>
					<aside className="flex min-h-0 flex-col gap-6">
						<ReportsActionsPanel activeReport={selectedReport} onSelectReport={setSelectedReport} />
					</aside>
				</div>
			</div>
		</AppLayout>
	);
}

function createRangeFromPreset(presetId: RangeOption["id"]): ReportRange {
	const selectedPreset = RANGE_OPTIONS.find((option) => option.id === presetId) ?? RANGE_OPTIONS[1];
	return createRangeFromDays(selectedPreset.days);
}

function createRangeFromDays(days: number): ReportRange {
	const end = new Date();
	const start = new Date(end);
	start.setDate(end.getDate() - (days - 1));

	return {
		start: formatForQuery(start),
		end: formatForQuery(end),
	};
}

function formatForQuery(date: Date) {
	return date.toISOString().slice(0, 10);
}

function formatDisplayRange(range: ReportRange) {
	const formatter = new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
	const startDate = formatter.format(new Date(range.start));
	const endDate = formatter.format(new Date(range.end));
	return `${startDate} - ${endDate}`;
}
