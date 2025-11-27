import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppointmentsHero } from "@/features/appointments/components/appointments-hero";
import { AppointmentsList } from "@/features/appointments/components/appointments-list";
import { AppointmentsCalendar } from "@/features/appointments/components/appointments-calendar";
import { AppointmentsQuickActions } from "@/features/appointments/components/quick-actions-card";
import { useAppointmentsList } from "@/features/appointments/hooks";
import { parseISODate, toISODateString } from "@/features/appointments/utils";
import type { AppointmentStatus } from "@/features/appointments/api";
import { AppointmentCreateDialog } from "@/features/appointments/components/appointment-create-dialog";
import { requireActiveProfessional } from "@/lib/route-guards";

type StatusFilterValue = "all" | AppointmentStatus;

const STATUS_FILTER_VALUES: StatusFilterValue[] = [
	"all",
	"scheduled",
	"confirmed",
	"completed",
	"no_show",
	"canceled",
];

const STATUS_LABELS: Record<StatusFilterValue, string> = {
	all: "Todas",
	scheduled: "Agendadas",
	confirmed: "Confirmadas",
	completed: "Concluídas",
	no_show: "Faltas",
	canceled: "Canceladas",
};

function parseStatus(value: unknown): StatusFilterValue {
	if (typeof value === "string" && STATUS_FILTER_VALUES.includes(value as StatusFilterValue)) {
		return value as StatusFilterValue;
	}
	return "all";
}

function parseDay(value: unknown): string {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return value;
	}
	return toISODateString(new Date());
}

type AppointmentsSearch = { day: string; status: StatusFilterValue };

export const Route = createFileRoute("/consultas")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	validateSearch: (search): AppointmentsSearch => ({
		day: parseDay(search.day),
		status: parseStatus(search.status),
	}),
	component: AppointmentsRoute,
});

function StatusFilter({
	value,
	onChange,
}: {
	value: StatusFilterValue;
	onChange: (next: StatusFilterValue) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{STATUS_FILTER_VALUES.map((option) => (
				<Button
					key={option}
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						"rounded-full border-[#D1D5DB] bg-white text-sm text-[#6E726E]",
						option === value && "border-[#3663D8] bg-[#F3F6FD] text-[#3663D8]",
					)}
					onClick={() => onChange(option)}
				>
					{STATUS_LABELS[option]}
				</Button>
			))}
		</div>
	);
}


function AppointmentsRoute() {
	const search = useSearch({ from: "/consultas" }) as AppointmentsSearch;
	const { day, status } = search;
	const navigate = Route.useNavigate();

	const selectedDate = useMemo(() => parseISODate(day, new Date()), [day]);
	const isoDay = toISODateString(selectedDate);

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const listQuery = useAppointmentsList({
		day: isoDay,
		status: status === "all" ? undefined : status,
		limit: 10,
	});

	const appointments = listQuery.data?.data ?? [];
	const total = listQuery.data?.meta.total ?? 0;

	const handleStatusChange = (next: StatusFilterValue) => {
		navigate({
			search: (prev) => ({
				...prev,
				status: next,
			}),
		});
	};

	const handleDateChange = (date: Date) => {
		navigate({
			search: (prev) => ({
				...prev,
				day: toISODateString(date),
			}),
		});
	};

	return (
		<AppLayout>
			<div className="space-y-8">
				<header className="space-y-1">
					<h1 className="text-2xl font-bold text-[#3B3D3B] md:text-[34px] md:leading-[42px]">
						Consultas
					</h1>
					<p className="text-sm text-[#6E726E]">Suas consultas, organizadas e acessíveis.</p>
				</header>

				<AppointmentsHero total={total} selectedDay={isoDay} />

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
					<div className="flex min-h-0 flex-1 flex-col gap-6">
						<section className="rounded-xl border border-[#E5E5E5] bg-white p-6">
							<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="text-lg font-semibold text-[#3B3D3B]">Filtros</h2>
									<p className="text-sm text-[#6E726E]">Refine a lista de consultas.</p>
								</div>
								<StatusFilter value={status} onChange={handleStatusChange} />
							</header>
						</section>

						<AppointmentsList
							appointments={appointments}
							isLoading={listQuery.isLoading}
							error={listQuery.error as Error | null | undefined}
						/>
					</div>

					<aside className="flex min-h-0 flex-col gap-6">
						<AppointmentsCalendar selectedDate={selectedDate} onChange={handleDateChange} />
						<AppointmentsQuickActions onCreateAppointment={() => setIsCreateOpen(true)} />
					</aside>
				</div>
			</div>

			<AppointmentCreateDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				initialDate={selectedDate}
			/>
		</AppLayout>
	);
}
