import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportRange } from "../api";
import { useAlertsReport } from "../hooks";

type ReportsAlertsCardProps = {
	range: ReportRange;
};

export function ReportsAlertsCard({ range }: ReportsAlertsCardProps) {
	const alertsQuery = useAlertsReport(range);
	const report = alertsQuery.data;

	const statusTotals = {
		open: report?.totals?.status?.open ?? 0,
		acknowledged: report?.totals?.status?.acknowledged ?? 0,
		closed: report?.totals?.status?.closed ?? 0,
	};
	const severityTotals = {
		low: report?.totals?.severity?.low ?? 0,
		medium: report?.totals?.severity?.medium ?? 0,
		high: report?.totals?.severity?.high ?? 0,
	};
	const totalAlerts = statusTotals.open + statusTotals.acknowledged + statusTotals.closed;
	const recentEntries = report?.recent ?? [];
	const hasData = totalAlerts > 0 || recentEntries.length > 0;

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-6 rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="space-y-1">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Relatório de alertas</h2>
				<p className="text-sm text-[#6E726E]">
					Visão consolidada dos alertas clínicos recebidos pelos pacientes.
				</p>
			</header>

			{alertsQuery.isLoading ? (
				<AlertsSkeleton />
			) : alertsQuery.isError ? (
				<ErrorState message="Não foi possível carregar o relatório de alertas." onRetry={() => alertsQuery.refetch()} />
			) : report && hasData ? (
				<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
					<div className="grid gap-4 md:grid-cols-3">
						<HighlightCard
							label="Alertas abertos"
							value={statusTotals.open}
							subtitle={`${statusTotals.open} aguardando triagem`}
							accent="attention"
						/>
						<HighlightCard
							label="Severidade alta"
							value={severityTotals.high}
							subtitle={`${formatPercent(severityTotals.high, totalAlerts)} do total`}
							accent="critical"
						/>
						<HighlightCard
							label="Alertas resolvidos"
							value={statusTotals.closed}
							subtitle={`${formatPercent(statusTotals.closed, totalAlerts)} concluídos`}
							accent="success"
						/>
					</div>

					<div className="grid gap-4">
						<h3 className="text-sm font-semibold uppercase tracking-wide text-[#6E726E]">
							Alertas recentes
						</h3>
						<ul className="space-y-3">
							{recentEntries.length === 0 ? (
								<li className="rounded-lg border border-dashed border-[#E5E5E5] px-4 py-3 text-xs text-[#6B7280]">
									Nenhum alerta recente no período.
								</li>
							) : (
								recentEntries.map((entry) => {
									const severity = entry.severity ?? "low";
									const status = entry.status ?? "open";
									const createdAt = entry.createdAt ?? "";
									const kind = entry.kind ?? "Alerta";
									const patientId = entry.patientId ?? "-";
									const key = entry.id ?? `${kind}-${createdAt}`;
									return (
									<li
											key={key}
										className="flex flex-col gap-1 rounded-lg border border-[#E5E5E5] bg-[#F9FAFB] px-4 py-3 text-sm text-[#1F2937]"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className="font-semibold text-[#3B3D3B]">{kind}</span>
											<span className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">
												{formatSeverity(severity)} · {formatStatus(status)}
											</span>
										</div>
										<span className="text-xs text-[#6B7280]">Paciente #{patientId}</span>
										<span className="text-xs text-[#6B7280]">{formatDateTime(createdAt)}</span>
									</li>
								);
								})
							)}
						</ul>
					</div>
				</div>
			) : (
				<EmptyState message="Nenhum alerta registrado no período." />
			)}
		</section>
	);
}

function HighlightCard({
	label,
	value,
	subtitle,
	accent,
}: {
	label: string;
	value: number;
	subtitle: string;
	accent: "attention" | "critical" | "success";
}) {
	const accentClass = {
		attention: "text-[#2563EB]",
		critical: "text-[#DC2626]",
		success: "text-[#16A34A]",
	}[accent];

	return (
		<div className="flex flex-col gap-2 rounded-lg bg-[#F3F6FD] px-5 py-4 text-[#1F2937]">
			<span className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">{label}</span>
			<span className={`text-2xl font-semibold ${accentClass}`}>{value}</span>
			<span className="text-xs text-[#6B7280]">{subtitle}</span>
		</div>
	);
}

function AlertsSkeleton() {
	return (
		<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
			<div className="grid gap-4 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-32" />
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-3 w-36" />
					</div>
				))}
			</div>
			<div className="space-y-3">
				{Array.from({ length: 4 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-40" />
						<Skeleton className="h-12 w-full" />
					</div>
				))}
			</div>
		</div>
	);
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
			<p>{message}</p>
			<Button
				type="button"
				variant="link"
				size="sm"
				className="h-auto px-0 text-[#2563EB]"
				onClick={onRetry}
			>
				Tentar novamente
			</Button>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="rounded-xl border border-dashed border-[#E5E5E5] p-6 text-sm text-[#6B7280]">
			{message}
		</div>
	);
}

function formatPercent(part: number, total: number) {
	if (total === 0) {
		return "0%";
	}
	return `${Math.round((part / total) * 100)}%`;
}

function formatSeverity(severity: "low" | "medium" | "high") {
	switch (severity) {
		case "high":
			return "Alta";
		case "medium":
			return "Média";
		case "low":
		default:
			return "Baixa";
	}
}

function formatStatus(status: "open" | "acknowledged" | "closed") {
	switch (status) {
		case "open":
			return "Aberto";
		case "acknowledged":
			return "Reconhecido";
		case "closed":
		default:
			return "Encerrado";
	}
}

function formatDateTime(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat("pt-BR", {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}
