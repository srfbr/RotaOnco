import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportRange } from "../api";
import { useAttendanceReport } from "../hooks";

type ReportsAbsenceCardProps = {
	range: ReportRange;
};

export function ReportsAbsenceCard({ range }: ReportsAbsenceCardProps) {
	const attendanceQuery = useAttendanceReport(range);
	const report = attendanceQuery.data;

	const totals = report?.totals;
	const scheduled = totals?.scheduled ?? 0;
	const confirmed = totals?.confirmed ?? 0;
	const completed = totals?.completed ?? 0;
	const noShow = totals?.noShow ?? 0;
	const cancellationRate = totals?.cancellationRate ?? 0;

	const attendanceUniverse = completed + noShow;
	const presenceRate = attendanceUniverse > 0 ? completed / attendanceUniverse : 0;
	const absenceRate = attendanceUniverse > 0 ? noShow / attendanceUniverse : 0;

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-6 rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="space-y-1">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Relatório de ausências</h2>
				<p className="text-sm text-[#6E726E]">
					Resumo das presenças e faltas em consultas agendadas.
				</p>
			</header>

			{attendanceQuery.isLoading ? (
				<AttendanceSkeleton />
			) : attendanceQuery.isError ? (
				<ErrorState message="Não foi possível carregar o relatório de ausências." onRetry={() => attendanceQuery.refetch()} />
			) : report ? (
				<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
					<div className="grid gap-4 md:grid-cols-2">
						<HighlightCard
							label="Pacientes que faltaram"
							value={noShow}
							subtitle={`Equivale a ${formatPercent(absenceRate)} das consultas avaliadas`}
							accent="negative"
						/>
						<HighlightCard
							label="Consultas realizadas"
							value={completed}
							subtitle={`Presença em ${formatPercent(presenceRate)}`}
							accent="positive"
						/>
					</div>

					<div className="grid gap-3 text-sm text-[#4B5563]">
						<BreakdownRow label="Agendadas" value={scheduled} />
						<BreakdownRow label="Confirmadas" value={confirmed} />
						<BreakdownRow label="Finalizadas" value={completed} />
						<BreakdownRow label="Faltas" value={noShow} />
						<BreakdownRow label="Taxa de cancelamento" value={formatPercent(cancellationRate)} />
					</div>
				</div>
			) : (
				<EmptyState message="Nenhum dado de presença para o período." />
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
	accent: "positive" | "negative";
}) {
	const accentClass = accent === "positive" ? "text-[#16A34A]" : "text-[#DC2626]";
	return (
		<div className="flex flex-col gap-2 rounded-lg bg-[#F9FAFB] px-5 py-4 text-[#1F2937]">
			<span className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">{label}</span>
			<span className={`text-2xl font-semibold ${accentClass}`}>{value}</span>
			<span className="text-xs text-[#6B7280]">{subtitle}</span>
		</div>
	);
}

function BreakdownRow({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="flex items-center justify-between rounded-md bg-[#F5F6F9] px-4 py-2">
			<span className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</span>
			<span className="text-sm font-semibold text-[#1F2937]">{value}</span>
		</div>
	);
}

function AttendanceSkeleton() {
	return (
		<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
			<div className="grid gap-4 md:grid-cols-2">
				{Array.from({ length: 2 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-6 w-16" />
						<Skeleton className="h-3 w-32" />
					</div>
				))}
			</div>
			<div className="space-y-3">
				{Array.from({ length: 5 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-40" />
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

function formatPercent(value: number) {
	if (!Number.isFinite(value)) {
		return "0%";
	}
	return `${Math.round(value * 100)}%`;
}
