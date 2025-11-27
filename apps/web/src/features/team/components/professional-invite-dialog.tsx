import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCreateProfessional } from "../hooks";
import type { ProfessionalCreateInput } from "../api";

export type ProfessionalInviteDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const initialFormState = {
	name: "",
	email: "",
	specialty: "",
	cpf: "",
	phone: "",
	clinicalUnit: "",
	assignAsAdmin: false,
	note: "",
};

export function ProfessionalInviteDialog({ open, onOpenChange }: ProfessionalInviteDialogProps) {
	const [formState, setFormState] = useState(initialFormState);
	const createProfessional = useCreateProfessional();
	const isSubmitting = createProfessional.isPending;

	useEffect(() => {
		if (!open) {
			setFormState(initialFormState);
		}
	}, [open]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const normalizedName = formState.name.trim();
		const normalizedEmail = formState.email.trim().toLowerCase();
		const cpfDigits = formState.cpf.replace(/\D/g, "");
		const normalizedSpecialty = formState.specialty.trim();
		const phoneDigits = formState.phone.replace(/\D/g, "");
		const sanitizedPhone = phoneDigits.length > 0 ? phoneDigits : undefined;

		if (!normalizedName || !normalizedEmail) {
			toast.error("Informe nome e e-mail do profissional.");
			return;
		}

		if (cpfDigits.length !== 11) {
			toast.error("CPF deve conter 11 dígitos.");
			return;
		}

		if (!sanitizedPhone || sanitizedPhone.length < 10) {
			toast.error("Informe um telefone de contato com DDD válido.");
			return;
		}

		const roles: ProfessionalCreateInput["roles"] = ["professional"];
		if (formState.assignAsAdmin) {
			roles.push("admin");
		}

		const payload: ProfessionalCreateInput = {
			name: normalizedName,
			email: normalizedEmail,
			documentId: cpfDigits,
			roles,
		};

		if (normalizedSpecialty) {
			payload.specialty = normalizedSpecialty;
		}

		if (sanitizedPhone) {
			payload.phone = sanitizedPhone;
		}

		try {
			await createProfessional.mutateAsync(payload);
			toast.success("Profissional cadastrado com sucesso.");
			onOpenChange(false);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Não foi possível cadastrar o profissional.";
			toast.error(message);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl border-t-4 border-[#3663D8] bg-[#F9FBFF]">
				<DialogHeader className="space-y-2">
					<DialogTitle className="text-[#1F56B9]">Adicionar profissional</DialogTitle>
					<DialogDescription className="text-[#3B3D3B]">
						Preencha os dados para cadastrar um novo membro da equipe e definir seu acesso inicial.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-6">
					<section className="rounded-xl border border-[#D9E3FF] bg-white p-6 shadow-sm">
						<h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#3663D8]">
							Informações do profissional
						</h4>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="invite-name" className="text-[#3B3D3B]">
									Nome completo
								</Label>
								<Input
									id="invite-name"
									value={formState.name}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, name: event.target.value }))
									}
									placeholder="Ex: Dra. Ana Souza"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invite-email" className="text-[#3B3D3B]">
									E-mail profissional
								</Label>
								<Input
									id="invite-email"
									type="email"
									value={formState.email}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, email: event.target.value }))
									}
									placeholder="nome.sobrenome@hospital.com"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invite-specialty" className="text-[#3B3D3B]">
									Especialidade principal
								</Label>
								<Input
									id="invite-specialty"
									value={formState.specialty}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, specialty: event.target.value }))
									}
									placeholder="Ex: Oncologia clínica"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invite-cpf" className="text-[#3B3D3B]">
									CPF
								</Label>
								<Input
									id="invite-cpf"
									type="tel"
									value={formState.cpf}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, cpf: event.target.value }))
									}
									placeholder="000.000.000-00"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invite-phone" className="text-[#3B3D3B]">
									Telefone celular
								</Label>
								<Input
									id="invite-phone"
									type="tel"
									value={formState.phone}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, phone: event.target.value }))
									}
									placeholder="(11) 90000-0000"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="invite-unit" className="text-[#3B3D3B]">
									Unidade de atuação
								</Label>
								<Input
									id="invite-unit"
									value={formState.clinicalUnit}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, clinicalUnit: event.target.value }))
									}
									placeholder="Ex: Unidade São Paulo"
									required
								/>
							</div>
						</div>
					</section>

					<section className="rounded-xl border border-[#D9E3FF] bg-white p-6 shadow-sm">
						<h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#3663D8]">
							Preferências de acesso
						</h4>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="invite-note" className="text-[#3B3D3B]">
									Observações adicionais (opcional)
								</Label>
								<textarea
									id="invite-note"
									value={formState.note}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, note: event.target.value }))
									}
									rows={3}
									placeholder="Compartilhe detalhes importantes para a integração do profissional."
									className="w-full rounded-md border border-[#CBD5F5] bg-white px-3 py-2 text-sm text-[#3B3D3B] shadow-sm placeholder:text-[#8690A7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3663D8]/40"
								/>
							</div>
							<div className="flex items-start gap-3 md:col-span-2">
								<Checkbox
									id="invite-admin"
									checked={formState.assignAsAdmin}
									onCheckedChange={(checked) =>
										setFormState((prev) => ({ ...prev, assignAsAdmin: Boolean(checked) }))
									}
								/>
								<div className="space-y-1">
									<Label htmlFor="invite-admin" className="text-[#3B3D3B]">
										Conceder acesso administrativo
									</Label>
									<p className="text-sm text-[#6E726E]">
										Permite gerenciar equipe, pacientes e configurações críticas do sistema.
									</p>
								</div>
							</div>
						</div>
					</section>
					<DialogFooter className="gap-3">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancelar
						</Button>
						<Button type="submit" disabled={isSubmitting} className="bg-[#3663D8] hover:bg-[#2D52B1]">
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Cadastrando...
								</>
							) : (
								"Cadastrar profissional"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
