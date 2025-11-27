import { AppLayout } from "@/components/app-layout";
import { ProfileHero } from "@/features/profile/components/profile-hero";
import { ProfileInfoForm } from "@/features/profile/components/profile-info-form";
import { ProfileOverviewCard } from "@/features/profile/components/profile-overview-card";
import { useProfessionalProfile, useUpdateProfessionalProfile } from "@/features/profile/hooks";
import { type ProfessionalProfileUpdateInput } from "@/features/profile/api";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { requireActiveProfessional } from "@/lib/route-guards";

export const Route = createFileRoute("/profile")({
	beforeLoad: async ({ context }) => {
		await requireActiveProfessional(context);
	},
	component: ProfileRoute,
});

function ProfileRoute() {
	const profileQuery = useProfessionalProfile();
	const updateProfileMutation = useUpdateProfessionalProfile();
	const profile = profileQuery.data ?? null;
	const errorMessage = profileQuery.isError
		? ((profileQuery.error instanceof Error ? profileQuery.error.message : null) ?? "Não foi possível carregar seus dados.")
		: null;

	const handleProfileUpdate = async (payload: ProfessionalProfileUpdateInput, successMessage: string) => {
		try {
			if (Object.keys(payload).length === 0) {
				return;
			}
			await updateProfileMutation.mutateAsync(payload);
			toast.success(successMessage);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Não foi possível atualizar o perfil.";
			toast.error(message);
		}
	};

	return (
		<AppLayout>
			<div className="space-y-8">
				<header className="space-y-1">
					<h1 className="text-2xl font-bold text-[#3B3D3B] md:text-[34px] md:leading-[42px]">
						Meu perfil
					</h1>
					<p className="text-sm text-[#6E726E]">
						Gerencie dados de acesso e preferências de contato em um único lugar.
					</p>
				</header>

				<ProfileHero lastUpdated={profile?.updatedAt} isLoading={profileQuery.isLoading} />

				{errorMessage ? (
					<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
						{errorMessage}
					</div>
				) : null}

				<div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
					<ProfileOverviewCard
						profile={profile}
						isLoading={profileQuery.isLoading}
						onAvatarUpdate={async (avatarDataUrl) =>
							handleProfileUpdate({ avatarDataUrl }, "Foto atualizada com sucesso.")
						}
						isUpdating={updateProfileMutation.isPending}
					/>
					<ProfileInfoForm
						profile={profile}
						isLoading={profileQuery.isLoading}
						onSubmit={async (payload) => handleProfileUpdate(payload, "Dados atualizados com sucesso.")}
						isSubmitting={updateProfileMutation.isPending}
					/>
				</div>
			</div>
		</AppLayout>
	);
}
