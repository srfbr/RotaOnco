import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaitTimesReport } from "../hooks";
import type { ReportRange } from "../api";

type ReportsWaitTimeCardProps = {
	range: ReportRange;
};

export function ReportsWaitTimeCard({ range }: ReportsWaitTimeCardProps) {
	const waitTimesQuery = useWaitTimesReport(range);
	const report = waitTimesQuery.data;

	const averageTriage = report?.averageDaysToTriage ?? 0;
	const averageTreatment = report?.averageDaysToTreatment ?? 0;
	const medianQueue = report?.medianQueueTime ?? 0;

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-6 rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="space-y-1">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Tempo de espera</h2>
				<p className="text-sm text-[#6E726E]">
					Tempo médio entre criação de paciente e início das consultas.
				</p>
			</header>

			{waitTimesQuery.isLoading ? (
				<WaitTimeSkeleton />
			) : waitTimesQuery.isError ? (
				<ErrorState message="Não foi possível carregar o relatório de tempo de espera." onRetry={() => waitTimesQuery.refetch()} />
			) : report ? (
				<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
					<div className="grid gap-4 md:grid-cols-3">
						<StatCard label="Média até triagem" value={formatDays(averageTriage)} accent />
						<StatCard label="Média até tratamento" value={formatDays(averageTreatment)} />
						<StatCard label="Fila mediana" value={formatDays(medianQueue)} />
					</div>
					<div className="space-y-4">
						<ProgressRow label="Meta de triagem" value={averageTriage} target={7} />
						<ProgressRow label="Meta de tratamento" value={averageTreatment} target={10} />
						<ProgressRow label="Fila mediana" value={medianQueue} target={8} />
					</div>
				</div>
			) : (
				<EmptyState message="Sem dados para o período selecionado." />
			)}
		</section>
	);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
	return (
		<div className="flex min-w-[180px] flex-1 flex-col gap-1 rounded-lg bg-[#F9FAFB] px-4 py-3 text-[#3B3D3B]">
			<span className="text-xs font-medium uppercase tracking-wide text-[#6E726E]">{label}</span>
			<span className={`text-lg font-semibold ${accent ? "text-[#3663D8]" : ""}`}>{value}</span>
		</div>
	);
}

function ProgressRow({ label, value, target }: { label: string; value: number; target: number }) {
	const percentage = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
	const isWithinTarget = value <= target;
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-xs font-medium text-[#6E726E]">
				<span>{label}</span>
				<span className={isWithinTarget ? "text-[#16A34A]" : "text-[#DC2626]"}>
					{formatDays(value)} · meta {target}d
				</span>
			</div>
			<div className="h-2 rounded-full bg-[#EEF2FF]">
				<div
					className="h-full rounded-full bg-[#3663D8] transition-all"
					style={{ width: `${Math.max(8, percentage)}%` }}
				/>
			</div>
		</div>
	);
}

function WaitTimeSkeleton() {
	return (
		<div className="grid gap-6 rounded-xl border border-[#E5E5E5] p-6">
			<div className="grid gap-4 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-6 w-24" />
					</div>
				))}
			</div>
			<div className="space-y-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-3 w-32" />
						<Skeleton className="h-2 w-full" />
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

function formatDays(value: number) {
	if (!Number.isFinite(value)) {
		return "0 dias";
	}
	return `${value < 1 && value > 0 ? value.toFixed(1) : Math.round(value)} dias`;
}
