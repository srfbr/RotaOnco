import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeamMemberStatus } from "@/features/team/data";
import { TeamHero } from "@/features/team/components/team-hero";
import { TeamTable } from "@/features/team/components/team-table";
import { TeamQuickActions } from "@/features/team/components/team-quick-actions";
import { TeamSummaryCard } from "@/features/team/components/team-summary-card";
import { useDeleteProfessional, useTeamDirectory } from "@/features/team/hooks";
import { requireActiveProfessional } from "@/lib/route-guards";
import { toast } from "sonner";

type TeamStatusFilter = "all" | TeamMemberStatus;

type TeamSearch = {
	status: TeamStatusFilter;
	query: string;
};

const STATUS_FILTERS: TeamStatusFilter[] = ["all", "active", "inactive"];

const STATUS_LABELS: Record<TeamStatusFilter, string> = {
	all: "Todos",
	active: "Ativos",
	inactive: "Inativos",
};

const TEAM_PAGE_SIZE = 25;

function parseStatus(value: unknown): TeamStatusFilter {
	if (typeof value === "string" && STATUS_FILTERS.includes(value as TeamStatusFilter)) {
		return value as TeamStatusFilter;
	}
	return "all";
}

function parseQuery(value: unknown): string {
	return typeof value === "string" ? value.slice(0, 120) : "";
}

export const Route = createFileRoute("/team")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	validateSearch: (search): TeamSearch => ({
		status: parseStatus(search.status),
		query: parseQuery(search.query),
	}),
	component: TeamRoute,
});

function TeamRoute() {
	const search = Route.useSearch() as TeamSearch;
	const navigate = Route.useNavigate();
	const { status, query } = search;

	const teamQuery = useTeamDirectory({
		search: query,
		status: status === "all" ? undefined : status,
		limit: TEAM_PAGE_SIZE,
		offset: 0,
	});
	const deleteProfessional = useDeleteProfessional();

	const directory = teamQuery.data ?? null;
	const members = directory?.members ?? [];
	const summary = directory?.summary ?? null;
	const totalMembers = summary?.total ?? directory?.pagination.total ?? 0;
	const totalActive = summary?.active ?? 0;
	const isLoading = teamQuery.isLoading || (teamQuery.isFetching && !directory);
	const errorMessage = teamQuery.isError
		? ((teamQuery.error instanceof Error ? teamQuery.error.message : null) ?? "Não foi possível carregar a equipe.")
		: null;

	const pendingMemberId = deleteProfessional.isPending ? deleteProfessional.variables ?? null : null;

	const handleStatusChange = (next: TeamStatusFilter) => {
		navigate({
			search: (prev) => ({
				...prev,
				status: next,
			}),
		});
	};

	const handleQueryChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				query: value,
			}),
		});
	};

	return (
		<AppLayout>
			<div className="space-y-8">
				<header className="space-y-1">
					<h1 className="text-2xl font-bold text-[#3B3D3B] md:text-[34px] md:leading-[42px]">
						Equipe médica
					</h1>
					<p className="text-sm text-[#6E726E]">Coordene especialistas, acompanhe licenças e mantenha a agenda alinhada.</p>
				</header>

				<TeamHero total={totalMembers} active={totalActive} />

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
					<section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#E5E5E5] bg-white">
						<header className="border-b border-[#E5E5E5] px-8 py-6">
							<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
								<div>
									<h2 className="text-2xl font-bold text-[#3B3D3B]">Lista de profissionais</h2>
									<p className="text-sm text-[#6E726E]">Busque pelo nome ou especialidade e filtre por disponibilidade.</p>
								</div>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
									<div className="w-full min-w-[200px] sm:w-64">
										<Input
											placeholder="Buscar por nome ou especialidade"
											value={query}
											onChange={(event) => handleQueryChange(event.target.value)}
										/>
									</div>
									<div className="flex flex-wrap gap-2">
										{STATUS_FILTERS.map((option) => (
											<Button
												key={option}
												type="button"
												variant="outline"
												size="sm"
												className={cn(
													"rounded-full border-[#D1D5DB] bg-white text-sm text-[#6E726E]",
													option === status && "border-[#3663D8] bg-[#F3F6FD] text-[#3663D8]",
												)}
												onClick={() => handleStatusChange(option)}
											>
												{STATUS_LABELS[option]}
											</Button>
										))}
									</div>
								</div>
							</div>
						</header>

						{errorMessage ? (
							<div className="mx-8 my-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
								{errorMessage}
							</div>
						) : (
							<>
								<TeamTable
									members={members}
									isLoading={isLoading}
									onDelete={async (member) => {
										if (deleteProfessional.isPending) {
											return;
										}
										const confirmed = window.confirm(
											`Tem certeza que deseja excluir ${member.fullName}? Essa ação não pode ser desfeita.`,
										);
										if (!confirmed) {
											return;
										}
										try {
											await deleteProfessional.mutateAsync(member.id);
											toast.success("Profissional removido com sucesso.");
										} catch (error) {
											const message =
												error instanceof Error
													? error.message
													: "Não foi possível excluir o profissional.";
											toast.error(message);
										}
									}}
									busyMemberId={pendingMemberId}
								/>
								<footer className="border-t border-[#E5E5E5] px-8 py-4 text-sm text-[#6E726E]">
									Exibindo {members.length} de {totalMembers} profissionais cadastrados.
								</footer>
							</>
						)}
					</section>

					<aside className="flex min-h-0 flex-col gap-6">
						<TeamSummaryCard summary={summary} isLoading={isLoading} />
						<TeamQuickActions />
					</aside>
				</div>
			</div>
		</AppLayout>
	);
}
