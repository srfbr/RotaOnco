import { AuthHero } from "@/components/auth-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import { useAuthSession } from "@/providers/auth-session-provider";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
	component: LoginRoute,
});

function LoginRoute() {
	const navigate = useNavigate({ from: "/login" });
	const { isAuthenticated } = useAuthSession();

	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/dashboard" });
		}
	}, [isAuthenticated, navigate]);

	return (
		<div className="flex min-h-screen w-full bg-white">
			<AuthHero />
			<section className="flex w-full max-w-full flex-col items-center justify-center px-6 py-12 sm:px-10 lg:w-[580px] lg:px-12">
				<div className="w-full max-w-[367px] space-y-10">
					<header className="space-y-3">
						<h1 className="text-[34px] font-bold leading-[42px] text-[#3B3D3B]">
							Bem-vindo de volta
						</h1>
						<p className="text-base text-[#6E726E]">
							Digite seu e-mail e senha para fazer login
						</p>
					</header>
					<LoginForm />
				</div>
			</section>
		</div>
	);
}

const loginSchema = z.object({
	email: z.string().min(1, { message: "Informe seu e-mail" }).email({ message: "Formato de e-mail inválido" }),
	password: z.string().min(8, { message: "A senha deve ter ao menos 8 caracteres" }),
});

function LoginForm() {
	const navigate = useNavigate({ from: "/login" });

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: async () => {
						toast.success("Login realizado com sucesso");
						try {
							const { data, error } = await apiClient.GET("/professionals/me");
							if (!error && data?.mustChangePassword) {
								navigate({ to: "/nova-senha" });
								return;
							}
						} catch {
							// fallback to dashboard navigation below
						}
						navigate({ to: "/dashboard" });
					},
					onError: (error) => {
						const message = error.error?.message ?? "Não foi possível autenticar";
						toast.error(message);
					},
				},
			);
		},
	});

	return (
		<form
			className="space-y-6"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="email">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name} className="block text-sm font-medium text-[#3B3D3B]">
							E-mail
						</Label>
						<div className="relative">
							<Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
							<Input
								id={field.name}
								type="email"
								autoComplete="email"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								className="h-12 rounded-lg border border-[#D1D5DB] pl-12 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus-visible:border-[#2E52B2] focus-visible:ring-[3px] focus-visible:ring-[#2E52B2]/50"
								placeholder="E-mail"
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

			<form.Field name="password">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name} className="block text-sm font-medium text-[#3B3D3B]">
							Senha de acesso
						</Label>
						<div className="relative">
							<Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
							<Input
								id={field.name}
								type="password"
								autoComplete="current-password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								className="h-12 rounded-lg border border-[#D1D5DB] pl-12 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus-visible:border-[#2E52B2] focus-visible:ring-[3px] focus-visible:ring-[#2E52B2]/50"
								placeholder="Senha de acesso"
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
						{state.isSubmitting ? "Autenticando..." : "Acessar"}
					</Button>
				)}
			</form.Subscribe>

			<div className="text-sm text-[#6E726E]">
				<span>Ainda não tem conta? </span>
				<Link to="/sign-up" className="font-semibold text-[#2E52B2] hover:underline">
					Cadastre-se
				</Link>
			</div>
		</form>
	);
}
