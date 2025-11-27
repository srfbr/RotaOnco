import type { ReactNode } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlertDetails, useAcknowledgeAlert } from "@/features/alerts/hooks";
import { getAlertSeverityInfo } from "@/features/dashboard/utils";
import type { Alert } from "@/features/alerts/api";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { requireActiveProfessional } from "@/lib/route-guards";

const DETAILS_FALLBACK = "Alerta registrado sem detalhes adicionais.";

export const Route = createFileRoute("/alerts/$alertId")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	component: AlertDetailsRoute,
});

function AlertDetailsRoute() {
	const { alertId } = Route.useParams();
	const numericAlertId = Number(alertId);
	const isValidId = Number.isFinite(numericAlertId) && numericAlertId > 0;

	const alertQuery = useAlertDetails(numericAlertId);
	const acknowledgeMutation = useAcknowledgeAlert(numericAlertId);

	const alert = alertQuery.data;
	const canAcknowledge = Boolean(alert && alert.status === "open");

	async function handleAcknowledge() {
		if (!alert) {
			return;
		}
		try {
			await acknowledgeMutation.mutateAsync();
			toast.success("Alerta marcado como lido");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Não foi possível atualizar o alerta.";
			toast.error(message);
		}
	}

	let content: ReactNode;
	if (!isValidId) {
		content = (
			<AlertMessage message="Identificador de alerta inválido." />
		);
	} else if (alertQuery.isLoading) {
		content = <AlertDetailsSkeleton />;
	} else if (alertQuery.isError) {
		const message = alertQuery.error instanceof Error ? alertQuery.error.message : "Não foi possível carregar o alerta.";
		content = <AlertMessage message={message} />;
	} else if (!alert) {
		content = <AlertMessage message="Alerta não encontrado." />;
	} else {
		const severity = getAlertSeverityInfo(alert);
		const status = getAlertStatusInfo(alert.status);

		content = (
			<section className="space-y-6">
				<div className="flex flex-wrap items-center gap-3">
					<span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${severity.className}`}>
						{severity.label}
					</span>
					<span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
						{status.label}
					</span>
				</div>

				<div>
					<h2 className="mb-2 text-lg font-semibold text-[#3B3D3B]">Descrição</h2>
					<p className="text-sm leading-6 text-[#4B5563]">
						{alert.details?.trim() ? alert.details : DETAILS_FALLBACK}
					</p>
				</div>

				<dl className="grid gap-4 md:grid-cols-2">
					<InfoRow label="Paciente" value={`#${alert.patientId}`} />
					<InfoRow label="Tipo" value={formatAlertKind(alert.kind)} />
					<InfoRow label="Criado em" value={formatDateTime(alert.createdAt)} />
					<InfoRow label="Resolvido em" value={alert.resolvedAt ? formatDateTime(alert.resolvedAt) : "Pendente"} />
					<InfoRow label="Profissional responsável" value={formatResolvedBy(alert.resolvedBy)} />
				</dl>
			</section>
		);
	}

	return (
		<AppLayout>
			<div className="flex h-full flex-col gap-8 overflow-hidden">
				<header className="space-y-4">
					<Button variant="outline" size="sm" asChild>
						<Link to="/dashboard" className="flex items-center gap-2">
							<ArrowLeft className="h-4 w-4" />
							<span>Voltar para o dashboard</span>
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold text-[#3B3D3B] md:text-[34px] md:leading-[42px]">
							{alert ? `Alerta #${alert.id}` : `Alerta #${alertId}`}
						</h1>																																																																																																	
						<p className="text-sm text-[#6B7280]">Detalhes completos do alerta clínico selecionado.</p>
					</div>
				</header>

				<section className="rounded-xl border border-[#E5E5E5] bg-white p-8 shadow-sm">
					{content}
				</section>

				{canAcknowledge && (
					<div>
						<Button
							onClick={handleAcknowledge}
							disabled={acknowledgeMutation.isPending}
						>
							{acknowledgeMutation.isPending ? "Atualizando alerta..." : "Marcar como lido"}
						</Button>
					</div>
				)}
			</div>
		</AppLayout>
	);
}

function AlertMessage({ message }: { message: string }) {
	return (
		<div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm text-[#B91C1C]">
			{message}
		</div>
	);
}

function AlertDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex gap-3">
				<Skeleton className="h-6 w-28" />
				<Skeleton className="h-6 w-32" />
			</div>
			<div className="space-y-2">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{Array.from({ length: 5 }).map((_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-5 w-32" />
					</div>
					))}
			</div>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<dt className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</dt>
			<dd className="text-sm font-medium text-[#374151]">{value}</dd>
		</div>
	);
}

function getAlertStatusInfo(status: Alert["status"]) {
	switch (status) {
		case "acknowledged":
			return { label: "Reconhecido", className: "bg-[#E5E7EB] text-[#374151]" };
		case "closed":
			return { label: "Encerrado", className: "bg-[#DCFCE7] text-[#166534]" };
		case "open":
		default:
			return { label: "Em aberto", className: "bg-[#DBEAFE] text-[#1D4ED8]" };
	}
}

function formatDateTime(iso?: string | null) {
	if (!iso) {
		return "N/A";
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "N/A";
	}
	return date.toLocaleString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatAlertKind(kind: string) {
	if (!kind.trim()) {
		return "Não informado";
	}
	return kind
		.replace(/[-_]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatResolvedBy(resolvedBy?: number | null) {
	if (!resolvedBy) {
		return "Pendente";
	}
	return `Profissional #${resolvedBy}`;
}
