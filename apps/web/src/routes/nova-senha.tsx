import { AuthHero } from "@/components/auth-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { requirePasswordChangeProfessional } from "@/lib/route-guards";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMemo } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentProfessional } from "@/features/profile/api";
import z from "zod";

export const Route = createFileRoute("/nova-senha")({
	beforeLoad: async ({ context }) => {
		await requirePasswordChangeProfessional(context);
	},
	component: NewPasswordRoute,
});

const passwordSchema = z.object({
	newPassword: z
		.string()
		.min(8, { message: "A senha deve ter ao menos 8 caracteres" })
		.max(191, { message: "A senha deve conter no máximo 191 caracteres" }),
	confirmPassword: z
		.string()
		.min(8, { message: "Confirme sua nova senha" }),
}).refine((value) => value.newPassword === value.confirmPassword, {
	message: "As senhas devem ser iguais",
	path: ["confirmPassword"],
});

function NewPasswordRoute() {
	const navigate = useNavigate({ from: "/nova-senha" });
	const queryClient = useQueryClient();

	const profileQuery = useQuery({
		queryKey: ["profile", "me"],
		queryFn: fetchCurrentProfessional,
		staleTime: 60 * 1000,
	});

	const profileErrorMessage = profileQuery.isError
		? ((profileQuery.error instanceof Error ? profileQuery.error.message : null) ?? "Não foi possível carregar seus dados.")
		: null;

	const professionalName = useMemo(() => {
		const name = profileQuery.data?.name ?? "";
		const trimmed = name.trim();
		if (!trimmed) {
			return "";
		}
		return trimmed.split(" ")[0] ?? trimmed;
	}, [profileQuery.data?.name]);

	const form = useForm({
		defaultValues: {
			newPassword: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: passwordSchema,
		},
		onSubmit: async ({ value }) => {
			const { error } = await apiClient.PATCH("/professionals/me/password", {
				body: {
					newPassword: value.newPassword,
					confirmPassword: value.confirmPassword,
				},
			});

			if (error) {
				toast.error(resolvePasswordUpdateError(error) ?? "Não foi possível atualizar a senha");
				return;
			}

			toast.success("Senha atualizada com sucesso");
			queryClient.invalidateQueries({ queryKey: ["profile"] }).catch(() => {});
			await authClient.getSession();
			authClient.$store.notify("$sessionSignal");
			navigate({ to: "/dashboard" });
		},
	});

	const handleSignOut = async () => {
		await authClient.signOut();
		navigate({ to: "/login" });
	};

	return (
		<div className="flex min-h-screen w-full bg-white">
			<AuthHero />
			<section className="flex w-full max-w-full flex-col items-center justify-center px-6 py-12 sm:px-10 lg:w-[580px] lg:px-12">
				<div className="w-full max-w-[367px] space-y-10">
					<header className="space-y-3">
						<p className="text-sm font-semibold uppercase tracking-wide text-[#6E726E]">Segurança no primeiro acesso</p>
						<h1 className="text-[34px] font-bold leading-[42px] text-[#3B3D3B]">
							Defina sua nova senha
						</h1>
						<p className="text-base text-[#6E726E]">
							{professionalName ? `Olá, ${professionalName}. ` : ""}
							Para continuar usando a plataforma, substitua a senha temporária recebida pelo convite.
						</p>
					</header>

					{profileErrorMessage ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
							{profileErrorMessage}
						</div>
					) : null}

					<form
						className="space-y-6"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							form.handleSubmit();
						}}
					>
						<form.Field name="newPassword">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name} className="block text-sm font-medium text-[#3B3D3B]">
										Nova senha
									</Label>
									<div className="relative">
										<Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
										<Input
											id={field.name}
											type="password"
											autoComplete="new-password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											className="h-12 rounded-lg border border-[#D1D5DB] pl-12 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus-visible:border-[#2E52B2] focus-visible:ring-[3px] focus-visible:ring-[#2E52B2]/50"
											placeholder="Crie uma senha segura"
										/>
									</div>
									{field.state.meta.errors.map((error) => (
										<p key={error?.message} className="text-sm text-[#DC2626]">
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Field name="confirmPassword">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name} className="block text-sm font-medium text-[#3B3D3B]">
										Confirme a nova senha
									</Label>
									<div className="relative">
										<Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
										<Input
											id={field.name}
											type="password"
											autoComplete="new-password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											className="h-12 rounded-lg border border-[#D1D5DB] pl-12 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus-visible:border-[#2E52B2] focus-visible:ring-[3px] focus-visible:ring-[#2E52B2]/50"
											placeholder="Repita a nova senha"
										/>
									</div>
									{field.state.meta.errors.map((error) => (
										<p key={error?.message} className="text-sm text-[#DC2626]">
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Subscribe>
							{(state) => (
								<Button
									type="submit"
									className="h-12 w-full rounded-lg bg-[#2E52B2] text-base font-medium text-white transition-colors hover:bg-[#264B96]"
									disabled={!state.canSubmit || state.isSubmitting}
								>
									{state.isSubmitting ? "Salvando..." : "Salvar nova senha"}
								</Button>
							)}
						</form.Subscribe>

						<div className="text-sm text-[#6E726E]">
							<p className="text-xs">
								Você será redirecionado ao painel após concluir a troca de senha.
							</p>
						</div>

						<button
							type="button"
							onClick={handleSignOut}
							className="text-sm font-medium text-[#2E52B2] transition hover:underline"
						>
							Sair e acessar com outra conta
						</button>
					</form>
				</div>
			</section>
		</div>
	);
}

function resolvePasswordUpdateError(error: unknown): string | null {
	if (!error) {
		return null;
	}
	if (typeof error === "string" && error.trim().length > 0) {
		return error.trim();
	}
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "object") {
		const payload = error as {
			message?: unknown;
			error?: unknown;
			data?: unknown;
			statusText?: unknown;
		};
		const nestedSources: unknown[] = [payload.message, payload.statusText];
		if (payload.error && payload.error !== error) {
			nestedSources.push(payload.error);
		}
		if (payload.data && payload.data !== error) {
			nestedSources.push(payload.data);
		}
		const candidate = nestedSources
			.map((entry) => resolvePasswordUpdateError(entry))
			.find((value) => typeof value === "string" && value.trim().length > 0);
		return candidate ?? null;
	}
	return null;
}
