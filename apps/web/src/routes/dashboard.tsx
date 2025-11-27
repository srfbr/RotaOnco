import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useDashboardAlerts,
	useDashboardPatients,
	useDashboardStats,
	useDashboardSummary,
} from "@/features/dashboard/hooks";
import {
	formatCPF,
	formatDays,
	formatPercentage,
	formatShortDate,
	getAlertSeverityInfo,
	getPatientStageLabel,
	getPatientStatusDescription,
} from "@/features/dashboard/utils";
import type { LucideIcon } from "lucide-react";
import {
	AlertCircle,
	CalendarCheck2,
	CalendarClock,
	Clock4,
	Users2,
} from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { requireActiveProfessional } from "@/lib/route-guards";
export const Route = createFileRoute("/dashboard")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	component: DashboardRoute,
});

function DashboardRoute() {
	const statsQuery = useDashboardStats();
	const patientsQuery = useDashboardPatients();
	const alertsQuery = useDashboardAlerts();
	const summaryQuery = useDashboardSummary();

	const handleAcknowledgeAlert = async (alertId: number) => {
		try {
			await alertsQuery.acknowledgeAlert(alertId);
			toast.success("Alerta marcado como lido");
			void summaryQuery.refetch();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Não foi possível atualizar o alerta";
			toast.error(message);
		}
	};

	return (
		<AppLayout>
			<div className="flex flex-col gap-6">
				<StatsGrid
					stats={statsQuery.data}
					isLoading={statsQuery.isLoading}
					error={statsQuery.error as Error | null | undefined}
				/>

				<div className="grid gap-6 xl:grid-cols-2">
					<RecentPatientsCard
						patients={patientsQuery.data}
						isLoading={patientsQuery.isLoading}
						error={patientsQuery.error as Error | null | undefined}
					/>
					<AlertsCard
						alerts={alertsQuery.data}
						isLoading={alertsQuery.isLoading}
						error={alertsQuery.error as Error | null | undefined}
						onAcknowledge={handleAcknowledgeAlert}
						isAcknowledging={alertsQuery.isAcknowledging}
					/>
				</div>

				<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
					<SummaryCard
						title="Status global"
						items={[
							{
								label: "Pacientes ativos",
								value: summaryQuery.data?.activePatients ?? 0,
							},
							{
								label: "Consultas hoje",
								value: summaryQuery.data?.todayAppointments ?? 0,
							},
							{
								label: "Alertas críticos",
								value: summaryQuery.data?.criticalAlerts ?? 0,
								accent: summaryQuery.data?.criticalAlerts ? "text-[#FF3B3B]" : undefined,
							},
						]}
						isLoading={summaryQuery.isLoading}
					/>
					<AgendaCard
						count={summaryQuery.data?.todayAppointments ?? 0}
						isLoading={summaryQuery.isLoading}
					/>
					<QuickActionsCard />
				</div>
			</div>
		</AppLayout>
	);
}

type StatsGridProps = {
	stats?: ReturnType<typeof useDashboardStats>["data"];
	isLoading: boolean;
	error?: Error | null;
};

function StatsGrid({ stats, isLoading, error }: StatsGridProps) {
	const cards: Array<{
		title: string;
		description: string;
		value: string;
		icon: LucideIcon;
	}> = [
		{
			title: "Total de pacientes",
			description: "Pacientes cadastrados",
			value: stats ? stats.totalPatients.toLocaleString("pt-BR") : "0",
			icon: Users2,
		},
		{
			title: "Consultas realizadas",
			description: "Últimos 30 dias",
			value: stats ? stats.consultationsLast30Days.toLocaleString("pt-BR") : "0",
			icon: CalendarCheck2,
		},
		{
			title: "Taxa de presença",
			description: "Comparação mensal",
			value: stats ? formatPercentage(stats.presenceRate) : "-",
			icon: Clock4,
		},
		{
			title: "Tempo médio",
			description: "Primeira consulta",
			value: stats ? formatDays(stats.averageWaitTime) : "-",
			icon: CalendarClock,
		},
	]

	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{cards.map((card) => (
				<StatCard
					key={card.title}
					title={card.title}
					description={card.description}
					value={card.value}
					icon={card.icon}
					loading={isLoading}
				/>
			))}
			{error && (
				<div className="col-span-full rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
					Não foi possível carregar os indicadores do dashboard.
				</div>
			)}
		</section>
	)
}

type StatCardProps = {
	title: string;
	description: string;
	value: string;
	icon: LucideIcon;
	loading: boolean;
};

function StatCard({ title, description, value, icon: Icon, loading }: StatCardProps) {
	return (
		<div className="relative overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
			<div className="flex flex-col gap-6">
				<div className="flex items-center gap-3">
					<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB]">
						<Icon className="h-5 w-5" />
					</div>
					<div>
						<p className="text-sm font-medium text-[#3B3D3B]">{title}</p>
						<p className="text-xs font-medium uppercase text-[#C8C8C8]">
							{description}
						</p>
					</div>
				</div>
				<div>
					{loading ? (
						<Skeleton className="h-10 w-24" />
					) : (
						<p className="text-4xl font-bold text-[#3663D8]">{value}</p>
					)}
				</div>
			</div>
		</div>
	)
}

type RecentPatientsCardProps = {
	patients: ReturnType<typeof useDashboardPatients>["data"];
	isLoading: boolean;
	error?: Error | null;
};

function RecentPatientsCard({ patients, isLoading, error }: RecentPatientsCardProps) {
	return (
		<section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="mb-6 shrink-0">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Pacientes recentes</h2>
			</header>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				{isLoading && <PatientCardSkeleton />}
				{error && (
					<p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
						Não foi possível carregar os pacientes recentes.
					</p>
				)}
				{!isLoading && !error && patients && patients.length === 0 && (
					<p className="text-sm text-[#6B7280]">Nenhum paciente encontrado recentemente.</p>
				)}
				{patients?.map((patient) => (
					<PatientCard key={patient.id} patient={patient} />
				))}
			</div>
		</section>
	)
}

type PatientCardProps = {
	patient: NonNullable<ReturnType<typeof useDashboardPatients>["data"]>[number];
};

function PatientCard({ patient }: PatientCardProps) {
	const badge = getPatientStageLabel(patient.stage, patient.status);
	const statusDescription = getPatientStatusDescription(patient.status);

	return (
		<article className="rounded-xl border border-[#E5E5E5] p-6">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<h3 className="text-lg font-medium text-[#3B3D3B]">{patient.fullName}</h3>
					<span
						className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${badge.color}`}
					>
						{badge.label}
					</span>
				</div>
				<div className="grid gap-3 text-sm text-[#6E726E] md:grid-cols-2">
					<p>
						<span className="font-medium">CPF:</span> {formatCPF(patient.cpf)}
					</p>
					<p>
						<span className="font-medium">Status:</span> {statusDescription}
					</p>
					<p>
						<span className="font-medium">Última:</span> {formatShortDate(patient.lastAppointment)}
					</p>
					<p>
						<span className="font-medium">Próxima:</span> {formatShortDate(patient.nextAppointment)}
					</p>
				</div>
			</div>
		</article>
	)
}

function PatientCardSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 2 }).map((_, index) => (
				<div key={index} className="rounded-xl border border-[#E5E5E5] p-6">
					<div className="flex flex-col gap-4">
						<Skeleton className="h-5 w-1/2" />
						<div className="grid gap-3 md:grid-cols-2">
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-3 w-32" />
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-24" />
						</div>
					</div>
				</div>
			))}
		</div>
	)
}

type AlertsCardProps = {
	alerts: ReturnType<typeof useDashboardAlerts>["data"];
	isLoading: boolean;
	error?: Error | null;
	onAcknowledge: (alertId: number) => Promise<void>;
	isAcknowledging: boolean;
};

function AlertsCard({ alerts, isLoading, error, onAcknowledge, isAcknowledging }: AlertsCardProps) {
	return (
		<section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="mb-6 shrink-0">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Notificações clínicas</h2>
			</header>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				{isLoading && <AlertCardSkeleton />}
				{error && (
					<p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
						Não foi possível carregar os alertas.
					</p>
				)}
				{!isLoading && !error && alerts && alerts.length === 0 && (
					<p className="text-sm text-[#6B7280]">Nenhum alerta clínico no momento.</p>
				)}
				{alerts?.map((alert) => {
					const severity = getAlertSeverityInfo(alert);
					const details = alert.details ?? "Alerta registrado sem detalhes adicionais.";
					return (
						<article key={alert.id} className="rounded-xl border border-[#E5E5E5] p-6">
							<header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<h3 className="text-lg font-medium text-[#3B3D3B]">Paciente #{alert.patientId}</h3>
								<span
									className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${severity.className}`}
								>
									{severity.label}
								</span>
							</header>
							<p
								className="mb-4 text-sm text-[#6E726E]"
								title={details}
								style={{
									display: "-webkit-box",
									WebkitLineClamp: 3,
									WebkitBoxOrient: "vertical" as const,
									overflow: "hidden",
								}}
							>
								{details}
							</p>
							<div className="flex flex-wrap items-center gap-3">
								<Button
									type="button"
									variant="outline"
									className="text-sm text-[#6E726E]"
									disabled={isAcknowledging}
									onClick={() => onAcknowledge(alert.id)}
								>
									Marcar como lido
								</Button>
								<Link
									to="/alerts/$alertId"
									params={{ alertId: alert.id.toString() }}
									className="text-sm font-medium text-[#2563EB] transition hover:underline"
								>
									Ver detalhes
								</Link>
							</div>
						</article>
					)
				})}
			</div>
		</section>
	)
}

function AlertCardSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 3 }).map((_, index) => (
				<div key={index} className="rounded-xl border border-[#E5E5E5] p-6">
					<div className="space-y-3">
						<Skeleton className="h-5 w-1/3" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-9 w-36" />
					</div>
				</div>
			))}
		</div>
	)
}

type SummaryCardProps = {
	title: string;
	items: { label: string; value: number; accent?: string }[];
	isLoading: boolean;
};

function SummaryCard({ title, items, isLoading }: SummaryCardProps) {
	return (
		<section className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<header className="mb-4">
				<h3 className="text-lg font-medium text-[#3B3D3B]">{title}</h3>
			</header>
			<div className="space-y-3 text-sm text-[#6E726E]">
				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-4 w-3/4" />
					</div>
				) : (
					items.map((item) => (
						<div key={item.label} className="flex items-center justify-between">
							<span>{item.label}</span>
							<span className={`font-medium text-[#3B3D3B] ${item.accent ?? ``}`}>
								{item.value}
							</span>
						</div>
					))
				)}
			</div>
		</section>
	)
}

type AgendaCardProps = {
	count: number;
	isLoading: boolean;
};

function AgendaCard({ count, isLoading }: AgendaCardProps) {
	return (
		<section className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<header className="mb-3">
				<h3 className="text-lg font-medium text-[#3B3D3B]">Agenda de hoje</h3>
			</header>
			{isLoading ? (
				<Skeleton className="h-4 w-3/4" />
			) : count > 0 ? (
				<p className="text-sm text-[#6E726E]">
					Você tem <span className="font-semibold text-[#2563EB]">{count}</span> {count === 1 ? "consulta" : "consultas"} agendadas para hoje.
				</p>
			) : (
				<p className="text-sm text-[#C8C8C8]">Nenhuma consulta agendada para hoje.</p>
			)}
		</section>
	)
}

function QuickActionsCard() {
	const navigate = useNavigate();
	const actions: Array<{ label: string; icon: LucideIcon; to: string }> = [
		{
			label: "Pacientes",
			icon: Users2,
			to: "/patients",
		},
		{
			label: "Consultas",
			icon: CalendarCheck2,
			to: "/consultas",
		},
		{
			label: "Relatórios",
			icon: AlertCircle,
			to: "/reports",
		},
	];

	return (
		<section className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<header className="mb-3">
				<h3 className="text-lg font-medium text-[#3B3D3B]">Ações rápidas</h3>
			</header>
			<ul className="space-y-3">
				{actions.map((action) => {
					const Icon = action.icon;
					return (
						<li key={action.label}>
							<button
								type="button"
								onClick={() => navigate({ to: action.to })}
								className="flex w-full items-center gap-3 rounded-md border border-[#E5E5E5] px-3 py-3 text-left text-sm font-medium text-[#6E726E] transition hover:border-[#2563EB]/40 hover:bg-[#F3F6FD]"
							>
								<Icon className="h-4 w-4 text-[#AAAAAA]" />
								<span>{action.label}</span>
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
