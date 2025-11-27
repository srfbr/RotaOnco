import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentProfessional, updateCurrentProfessional, type ProfessionalProfileUpdateInput } from "./api";
import { toProfileViewModel, type ProfileViewModel } from "./types";

const PROFILE_SCOPE = "profile";

type UseProfessionalProfileOptions = {
	enabled?: boolean;
};

export function useProfessionalProfile({ enabled = true }: UseProfessionalProfileOptions = {}) {
	return useQuery<ProfileViewModel>({
		queryKey: [PROFILE_SCOPE, "me"],
		queryFn: async () => {
			const professional = await fetchCurrentProfessional();
			if (!professional) {
				throw new Error("Profissional não encontrado");
			}

			return toProfileViewModel(professional);
		},
		staleTime: 60 * 1000,
		enabled,
	});
}

export function useUpdateProfessionalProfile() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: ProfessionalProfileUpdateInput) => {
			const professional = await updateCurrentProfessional(input);
			if (!professional) {
				throw new Error("Perfil não encontrado");
			}
			return toProfileViewModel(professional);
		},
		onSuccess: (updatedProfile) => {
			queryClient.setQueryData([PROFILE_SCOPE, "me"], updatedProfile);
		},
	});
}
