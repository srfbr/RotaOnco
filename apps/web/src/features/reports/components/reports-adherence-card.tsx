import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportRange } from "../api";
import { useAdherenceReport } from "../hooks";

type ReportsAdherenceCardProps = {
	range: ReportRange;
};

export function ReportsAdherenceCard({ range }: ReportsAdherenceCardProps) {
	const adherenceQuery = useAdherenceReport(range);
	const report = adherenceQuery.data;

	const totals = report?.totals;
	const patients = report?.patients;
	const completedAppointments = totals?.completedAppointments ?? 0;
	const symptomReportCount = totals?.symptomReportCount ?? 0;
	const engagedPatients = patients?.engaged ?? 0;
	const reportingSymptoms = patients?.reportingSymptoms ?? 0;
	const withCompletedAppointments = patients?.withCompletedAppointments ?? 0;
	const engagementRate = patients?.engagementRate ?? 0;

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-6 rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="space-y-1">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Adesão ao tratamento</h2>
				<p className="text-sm text-[#6E726E]">
					Monitoramento de pacientes que seguem o plano e notificam sintomas.
				</p>
			</header>

			{adherenceQuery.isLoading ? (
				<AdherenceSkeleton />
			) : adherenceQuery.isError ? (
				<ErrorState message="Não foi possível carregar o relatório de adesão." onRetry={() => adherenceQuery.refetch()} />
			) : report ? (
				<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
					<div className="grid gap-4 md:grid-cols-3">
						<HighlightCard
							label="Pacientes engajados"
							value={engagedPatients}
							subtitle={`${formatPercent(engagementRate)} dos pacientes com consultas realizadas`}
							accent="positive"
						/>
						<HighlightCard
							label="Consultas concluídas"
							value={completedAppointments}
							subtitle="Nos últimos agendamentos avaliados"
							accent="neutral"
						/>
						<HighlightCard
							label="Alertas de sintomas"
							value={symptomReportCount}
							subtitle={symptomReportCount === 1 ? "1 registro de sintomas" : `${symptomReportCount} registros de sintomas`}
							accent="alert"
						/>
					</div>

					<div className="grid gap-3 text-sm text-[#4B5563]">
						<BreakdownRow label="Pacientes com consultas finalizadas" value={withCompletedAppointments} />
						<BreakdownRow label="Pacientes reportando sintomas" value={reportingSymptoms} />
						<BreakdownRow label="Pacientes engajados" value={engagedPatients} />
					</div>
				</div>
			) : (
				<EmptyState message="Nenhum dado de adesão para o período." />
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
	accent: "positive" | "neutral" | "alert";
}) {
	const accentClass = {
		positive: "text-[#16A34A]",
		neutral: "text-[#1F2937]",
		alert: "text-[#2563EB]",
	}[accent];

	return (
		<div className="flex flex-col gap-2 rounded-lg bg-[#F9FAFB] px-5 py-4 text-[#1F2937]">
			<span className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">{label}</span>
			<span className={`text-2xl font-semibold ${accentClass}`}>{value}</span>
			<span className="text-xs text-[#6B7280]">{subtitle}</span>
		</div>
	);
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-center justify-between rounded-md bg-[#F5F6F9] px-4 py-2">
			<span className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</span>
			<span className="text-sm font-semibold text-[#1F2937]">{value}</span>
		</div>
	);
}

function AdherenceSkeleton() {
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
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-48" />
						<Skeleton className="h-8 w-full" />
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

function formatPercent(value: number | undefined) {
	if (!Number.isFinite(value ?? NaN)) {
		return "0%";
	}
	return `${Math.round((value ?? 0) * 100)}%`;
}
