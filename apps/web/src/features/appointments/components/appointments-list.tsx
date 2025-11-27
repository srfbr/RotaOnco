import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Circle, Edit3, XCircle } from "lucide-react";
import type { AppointmentListItem } from "../api";
import {
	formatAppointmentDate,
	getAppointmentStatusAccent,
	getAppointmentStatusLabel,
	getAppointmentTypeLabel,
} from "../utils";
import { Skeleton } from "@/components/ui/skeleton";

function AppointmentCard({ appointment }: { appointment: AppointmentListItem }) {
	const patientName = appointment.patient?.fullName ?? `Paciente #${appointment.patientId}`;
	const typeLabel = getAppointmentTypeLabel(appointment.type);
	const statusLabel = getAppointmentStatusLabel(appointment.status);
	const statusAccent = getAppointmentStatusAccent(appointment.status);
	const scheduledFor = formatAppointmentDate(appointment.startsAt);

	return (
		<article className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-lg font-semibold text-[#3B3D3B]">{patientName}</h3>
					<p className="text-sm text-[#6E726E]">{scheduledFor}</p>
				</div>
				<div className="flex flex-col items-end gap-2 text-right">
					<span className="inline-flex items-center justify-center rounded-full bg-[#F2F4F8] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#3663D8]">
						{typeLabel}
					</span>
					<span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusAccent}`}>
						<Circle className="h-3 w-3" />
						{statusLabel}
					</span>
				</div>
			</div>
			<footer className="mt-6 flex flex-wrap gap-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="text-[#B91C1C]"
					onClick={() => toast.info("Cancelamento de consulta em breve")}
				>
					<XCircle className="h-4 w-4" />
					Cancelar
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => toast.info("Edição de consulta em breve")}
				>
					<Edit3 className="h-4 w-4" />
					Editar
				</Button>
			</footer>
		</article>
	);
}

function AppointmentCardSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 3 }).map((_, index) => (
				<article key={index} className="rounded-xl border border-[#E5E5E5] bg-white p-6">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div className="space-y-2">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-32" />
						</div>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-6 w-20" />
						</div>
					</div>
					<div className="mt-6 flex flex-wrap gap-3">
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-24" />
					</div>
				</article>
			))}
		</div>
	);
}

export function AppointmentsList({
	appointments,
	isLoading,
	error,
}: {
	appointments: AppointmentListItem[];
	isLoading: boolean;
	error: Error | null | undefined;
}) {
	return (
		<section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold text-[#3B3D3B]">Suas consultas</h2>
					<p className="text-sm text-[#6E726E]">Acompanhe os atendimentos agendados.</p>
				</div>
			</header>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				{isLoading && !appointments.length && <AppointmentCardSkeleton />}
				{error && (
					<p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
						Não foi possível carregar as consultas.
					</p>
				)}
				{!isLoading && !error && appointments.length === 0 && (
					<p className="text-sm text-[#6E726E]">
						Nenhuma consulta agendada para o período selecionado.
					</p>
				)}
				{appointments.map((appointment) => (
					<AppointmentCard key={appointment.id} appointment={appointment} />
				))}
			</div>
		</section>
	);
}
