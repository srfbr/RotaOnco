import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TeamMember, TeamMemberStatus, TeamSummaryCounts } from "./data";
import {
	createProfessional,
	deleteProfessional as deleteProfessionalRequest,
	fetchProfessionals,
	type ProfessionalCreateInput,
} from "./api";

const TEAM_SCOPE = "team-directory";

export type UseTeamDirectoryOptions = {
	search?: string;
	status?: TeamMemberStatus;
	limit?: number;
	offset?: number;
};

export type TeamDirectoryQuery = {
	members: TeamMember[];
	summary: TeamSummaryCounts;
	pagination: {
		total: number;
		limit: number;
		offset: number;
	};
};

export function useTeamDirectory({ search, status, limit = 25, offset = 0 }: UseTeamDirectoryOptions) {
	return useQuery<TeamDirectoryQuery>({
		queryKey: [TEAM_SCOPE, { search: search?.trim() ?? "", status, limit, offset }],
		queryFn: async () => {
			const response = await fetchProfessionals({
				query: search,
				status,
				limit,
				offset,
				includeSummary: true,
			});

			const members: TeamMember[] = response.data.map((professional) => ({
				id: professional.id,
				fullName: professional.name,
				specialty: professional.specialty ?? null,
				documentId: professional.documentId,
				phone: professional.phone ?? null,
				email: professional.email,
				status: professional.isActive ? "active" : "inactive",
				roles: professional.roles,
				updatedAt: professional.updatedAt ?? null,
			}));

			const fallbackSummary: TeamSummaryCounts = {
				total: response.meta.total,
				active: members.filter((member) => member.status === "active").length,
				inactive: members.filter((member) => member.status === "inactive").length,
			};

			const summary: TeamSummaryCounts = {
				total: response.meta.statusCounts?.total ?? fallbackSummary.total,
				active: response.meta.statusCounts?.active ?? fallbackSummary.active,
				inactive: response.meta.statusCounts?.inactive ?? fallbackSummary.inactive,
			};

			return {
				members,
				summary,
				pagination: {
					total: response.meta.total,
					limit: response.meta.limit,
					offset: response.meta.offset,
				},
			};
		},
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	});
}

export function useCreateProfessional() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: [TEAM_SCOPE, "create"],
		mutationFn: (input: ProfessionalCreateInput) => createProfessional(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [TEAM_SCOPE] });
		},
	});
}

export function useDeleteProfessional() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, number>({
		mutationKey: [TEAM_SCOPE, "delete"],
		mutationFn: (userId) => deleteProfessionalRequest(userId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [TEAM_SCOPE] });
		},
	});
}
