import { AppLayout } from "@/components/app-layout";
import { createFileRoute } from "@tanstack/react-router";
import {
	usePatientsList,
	usePatientsMetrics,
} from "@/features/patients/hooks";
import {
	MetricsCards,
} from "@/features/patients/components/metrics-cards";
import { PatientsFilters } from "@/features/patients/components/patients-filters";
import { PatientsTable } from "@/features/patients/components/patients-table";
import { QuickActionsCard } from "@/features/patients/components/quick-actions-card";
import type { StageFilterValue, StatusFilterValue } from "@/features/patients/utils";
import { useEffect, useState } from "react";
import { PatientDetailsDialog } from "@/features/patients/components/patient-details-dialog";
import { PatientCreateDialog } from "@/features/patients/components/patient-create-dialog";
import { requireActiveProfessional } from "@/lib/route-guards";

const PAGE_SIZE = 10;
const STAGE_VALUES: StageFilterValue[] = ["all", "pre_triage", "in_treatment", "post_treatment"];
const STATUS_VALUES: StatusFilterValue[] = ["all", "active", "inactive", "at_risk"];

function parseStage(value: unknown): StageFilterValue {
	if (typeof value === "string" && STAGE_VALUES.includes(value as StageFilterValue)) {
		return value as StageFilterValue;
	}
	return "all";
}

function parseStatus(value: unknown): StatusFilterValue {
	if (typeof value === "string" && STATUS_VALUES.includes(value as StatusFilterValue)) {
		return value as StatusFilterValue;
	}
	return "all";
}

function parsePage(value: unknown): number {
	const parsed = Number(value);
	if (Number.isFinite(parsed) && parsed >= 1) {
		return Math.floor(parsed);
	}
	return 1;
}

function parseSelectedPatientId(value: unknown): number | null {
	const parsed = Number(value);
	if (Number.isFinite(parsed) && parsed > 0) {
		return Math.floor(parsed);
	}
	return null;
}

export const Route = createFileRoute("/patients")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	validateSearch: (search) => {
		return {
			q: typeof search.q === "string" ? search.q : "",
			stage: parseStage(search.stage),
			status: parseStatus(search.status),
			page: parsePage(search.page),
			selectedPatientId: parseSelectedPatientId(search.selectedPatientId),
		};
	},
	component: PatientsRoute,
});

function PatientsRoute() {
	const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
	const [isDetailsOpen, setIsDetailsOpen] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const search = Route.useSearch() as {
		q: string;
		stage: StageFilterValue;
		status: StatusFilterValue;
		page: number;
		selectedPatientId: number | null;
	};
	const { q, stage, status, page, selectedPatientId: selectedFromSearch } = search;
	const navigate = Route.useNavigate();

	const metricsQuery = usePatientsMetrics();
	const listQuery = usePatientsList({
		q: q.trim() ? q.trim() : undefined,
		stage: stage === "all" ? undefined : stage,
		status: status === "all" ? undefined : status,
		page,
		limit: PAGE_SIZE,
	});

	const patients = listQuery.data?.data ?? [];
	const total = listQuery.data?.meta.total ?? 0;

	useEffect(() => {
		if (selectedFromSearch && selectedFromSearch > 0) {
			setSelectedPatientId(selectedFromSearch);
			setIsDetailsOpen(true);
		}
	}, [selectedFromSearch]);

	const handleSearch = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				q: value.trim(),
				page: 1,
			}),
		});
	};

	const handleStageChange = (next: StageFilterValue) => {
		navigate({
			search: (prev) => ({
				...prev,
				stage: next,
				page: 1,
			}),
		});
	};

	const handleStatusChange = (next: StatusFilterValue) => {
		navigate({
			search: (prev) => ({
				...prev,
				status: next,
				page: 1,
			}),
		});
	};

	const handlePageChange = (nextPage: number) => {
		navigate({
			search: (prev) => ({
				...prev,
				page: nextPage,
			}),
		});
	};

	const handleReset = () => {
		navigate({
			search: () => ({ q: "", stage: "all", status: "all", page: 1, selectedPatientId: null }),
		});
	};

	const handleViewDetails = (patientId: number) => {
		setSelectedPatientId(patientId);
		setIsDetailsOpen(true);
		navigate({
			search: (prev) => ({
				...prev,
				selectedPatientId: patientId,
			}),
		});
	};

	const handleDetailsOpenChange = (open: boolean) => {
		setIsDetailsOpen(open);
		if (!open) {
			setSelectedPatientId(null);
			navigate({
				search: (prev) => ({
					...prev,
					selectedPatientId: null,
				}),
			});
		}
	};

	const handleCreateOpenChange = (open: boolean) => {
		setIsCreateOpen(open);
	};

	return (
		<AppLayout>
			<div className="space-y-8">
				<header>
					<h1 className="text-2xl font-bold text-[#3B3D3B] md:text-[34px] md:leading-[42px]">
						Pacientes
					</h1>
				</header>

				<MetricsCards
					metrics={metricsQuery.data}
					isLoading={metricsQuery.isLoading}
					error={metricsQuery.error as Error | null | undefined}
				/>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
					<div className="space-y-6">
						<PatientsFilters
							initialSearch={q}
							stage={stage}
							status={status}
							onApplySearch={handleSearch}
							onStageChange={handleStageChange}
							onStatusChange={handleStatusChange}
							onReset={handleReset}
						/>

						<PatientsTable
							patients={patients}
							isLoading={listQuery.isLoading && !listQuery.data}
							error={listQuery.error as Error | null | undefined}
							page={page}
							limit={PAGE_SIZE}
							total={total}
							onPageChange={handlePageChange}
							onViewDetails={handleViewDetails}
						/>
					</div>

					<QuickActionsCard
						onResetFilters={handleReset}
						onCreatePatient={() => setIsCreateOpen(true)}
					/>
				</div>
			</div>

			<PatientDetailsDialog
				open={isDetailsOpen}
				patientId={selectedPatientId}
				onOpenChange={handleDetailsOpenChange}
			/>

			<PatientCreateDialog open={isCreateOpen} onOpenChange={handleCreateOpenChange} />
		</AppLayout>
	);
}
