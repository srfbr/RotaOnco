import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { PatientCreateInput, PatientStage, PatientStatus } from "../api";
import { useCreatePatient } from "../hooks";
import { stageFilterOptions, statusFilterOptions } from "../utils";

type PatientCreateDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type ContactForm = {
	id: string;
	fullName: string;
	relation: string;
	phone: string;
	isPrimary: boolean;
};

type FormState = {
	fullName: string;
	cpf: string;
	pin: string;
	birthDate: string;
	phone: string;
	emergencyPhone: string;
	tumorType: string;
	clinicalUnit: string;
	stage: PatientStage;
	status: PatientStatus;
	contacts: ContactForm[];
};

const stageOptions = stageFilterOptions.filter((option) => option.value !== "all");
const statusOptions = statusFilterOptions.filter((option) => option.value !== "all");

const initialFormState: FormState = {
	fullName: "",
	cpf: "",
	pin: "",
	birthDate: "",
	phone: "",
	emergencyPhone: "",
	tumorType: "",
	clinicalUnit: "",
	stage: "pre_triage",
	status: "active",
	contacts: [],
};

function createContact(): ContactForm {
	return {
		id: Math.random().toString(36).slice(2),
		fullName: "",
		relation: "",
		phone: "",
		isPrimary: false,
	};
}

export function PatientCreateDialog({ open, onOpenChange }: PatientCreateDialogProps) {
	const [formState, setFormState] = useState<FormState>(initialFormState);
	const createMutation = useCreatePatient();

	useEffect(() => {
		if (!open) {
			setFormState(initialFormState);
		}
	}, [open]);

	const isSaving = createMutation.isPending;

	const requiredFieldsValid = useMemo(() => {
		const cpfDigits = formState.cpf.replace(/\D/g, "");
		const pinDigits = formState.pin.replace(/\D/g, "");

		return (
			formState.fullName.trim().length > 0 &&
			cpfDigits.length === 11 &&
			pinDigits.length === 4
		);
	}, [formState.fullName, formState.cpf, formState.pin]);

	const sanitizedContacts = useMemo(() => {
		return formState.contacts
			.map((contact) => ({
				fullName: contact.fullName.trim(),
				relation: contact.relation.trim(),
				phone: contact.phone.trim(),
				isPrimary: contact.isPrimary,
			}))
			.filter((contact) => contact.fullName && contact.relation && contact.phone);
	}, [formState.contacts]);

	const handleClose = () => {
		onOpenChange(false);
	};

	const handleAddContact = () => {
		setFormState((prev) => ({
			...prev,
			contacts: [...prev.contacts, createContact()],
		}));
	};

	const handleRemoveContact = (id: string) => {
		setFormState((prev) => ({
			...prev,
			contacts: prev.contacts.filter((contact) => contact.id !== id),
		}));
	};

	const handleContactChange = (id: string, field: keyof ContactForm, value: string | boolean) => {
		setFormState((prev) => ({
			...prev,
			contacts: prev.contacts.map((contact) => {
				if (contact.id !== id) return contact;

				if (field === "isPrimary") {
					return { ...contact, isPrimary: Boolean(value) };
				}

				return { ...contact, [field]: value } as ContactForm;
			}),
		}));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!requiredFieldsValid) {
			toast.error("Preencha nome, CPF com 11 dígitos e PIN de 4 dígitos.");
			return;
		}

		const cpfDigits = formState.cpf.replace(/\D/g, "");
		const pinDigits = formState.pin.replace(/\D/g, "");

		const payload: PatientCreateInput = {
			fullName: formState.fullName.trim(),
			cpf: cpfDigits,
			pin: pinDigits,
			birthDate: formState.birthDate.trim() ? formState.birthDate : undefined,
			phone: formState.phone.trim() ? formState.phone.trim() : undefined,
			emergencyPhone: formState.emergencyPhone.trim()
				? formState.emergencyPhone.trim()
				: undefined,
			tumorType: formState.tumorType.trim() ? formState.tumorType.trim() : undefined,
			clinicalUnit: formState.clinicalUnit.trim() ? formState.clinicalUnit.trim() : undefined,
			stage: formState.stage,
			status: formState.status,
			contacts:
				sanitizedContacts.length > 0
					? sanitizedContacts.map((contact) => ({
						fullName: contact.fullName,
						relation: contact.relation,
						phone: contact.phone,
						isPrimary: contact.isPrimary,
					}))
					: undefined,
		};

		try {
			await createMutation.mutateAsync(payload);
			toast.success("Paciente criado com sucesso");
			onOpenChange(false);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Não foi possível criar o paciente";
			toast.error(message);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl border-t-4 border-[#3663D8] bg-[#F9FBFF]">
				<DialogHeader className="space-y-2">
					<DialogTitle className="text-[#1F56B9]">Cadastrar paciente</DialogTitle>
					<DialogDescription className="text-[#3B3D3B]">
						Informe os dados essenciais para registrar um novo paciente e conectar sua jornada aos profissionais responsáveis.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-6">
					<section className="space-y-6 rounded-xl border border-[#D9E3FF] bg-white p-6 shadow-sm">
						<div className="space-y-1">
							<h4 className="text-sm font-semibold uppercase tracking-wide text-[#3663D8]">
								Dados do paciente
							</h4>
							<p className="text-sm text-[#6E726E]">
								Preencha informações usadas no acompanhamento clínico e na comunicação.
							</p>
						</div>

						<div className="grid gap-5 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="create-fullName" className="text-[#3B3D3B]">
									Nome completo
								</Label>
								<p className="text-xs text-[#6E726E]">Identificação exibida para toda a equipe.</p>
								<Input
									id="create-fullName"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.fullName}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, fullName: event.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-cpf" className="text-[#3B3D3B]">
									CPF
								</Label>
								<p className="text-xs text-[#6E726E]">Informe 11 dígitos sem separadores.</p>
								<Input
									id="create-cpf"
									inputMode="numeric"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.cpf}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, cpf: event.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-pin" className="text-[#3B3D3B]">
									PIN de acesso
								</Label>
								<p className="text-xs text-[#6E726E]">Código de 4 dígitos usado no app do paciente.</p>
								<Input
									id="create-pin"
									inputMode="numeric"
									maxLength={4}
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.pin}
									onChange={(event) => {
										const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
										setFormState((prev) => ({ ...prev, pin: digits }));
									}}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-birthDate" className="text-[#3B3D3B]">
									Data de nascimento
								</Label>
								<p className="text-xs text-[#6E726E]">Usada para validar idade e documentação.</p>
								<Input
									id="create-birthDate"
									type="date"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.birthDate}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, birthDate: event.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-phone" className="text-[#3B3D3B]">
									Telefone
								</Label>
								<p className="text-xs text-[#6E726E]">Contato principal para avisos.</p>
								<Input
									id="create-phone"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.phone}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, phone: event.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-emergencyPhone" className="text-[#3B3D3B]">
									Telefone de emergência
								</Label>
								<p className="text-xs text-[#6E726E]">Contato secundário em situações críticas.</p>
								<Input
									id="create-emergencyPhone"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.emergencyPhone}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, emergencyPhone: event.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-tumorType" className="text-[#3B3D3B]">
									Tipo de tumor
								</Label>
								<p className="text-xs text-[#6E726E]">Ajuda a direcionar a equipe multidisciplinar.</p>
								<Input
									id="create-tumorType"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.tumorType}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, tumorType: event.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="create-clinicalUnit" className="text-[#3B3D3B]">
									Unidade clínica
								</Label>
								<p className="text-xs text-[#6E726E]">Local responsável pelo atendimento.</p>
								<Input
									id="create-clinicalUnit"
									className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
									value={formState.clinicalUnit}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, clinicalUnit: event.target.value }))
									}
								/>
							</div>
						</div>
					</section>

					<section className="grid gap-6 rounded-xl border border-[#D9E3FF] bg-white p-6 shadow-sm md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="create-stage" className="text-[#3B3D3B]">
								Etapa do tratamento
							</Label>
							<p className="text-xs text-[#6E726E]">Define o momento atual da jornada clínica.</p>
							<select
								id="create-stage"
								className="h-10 w-full rounded-md border border-[#CBD5F5] bg-white px-3 text-sm text-[#3B3D3B] shadow-xs focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40"
								value={formState.stage}
								onChange={(event) =>
									setFormState((prev) => ({ ...prev, stage: event.target.value as PatientStage }))
								}
							>
								{stageOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-status" className="text-[#3B3D3B]">
								Status
							</Label>
							<p className="text-xs text-[#6E726E]">Mostra se o paciente está ativo, em risco ou inativo.</p>
							<select
								id="create-status"
								className="h-10 w-full rounded-md border border-[#CBD5F5] bg-white px-3 text-sm text-[#3B3D3B] shadow-xs focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40"
								value={formState.status}
								onChange={(event) =>
									setFormState((prev) => ({ ...prev, status: event.target.value as PatientStatus }))
								}
							>
								{statusOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>
					</section>

					<section className="space-y-4 rounded-xl border border-[#D9E3FF] bg-white p-6 shadow-sm">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h4 className="text-sm font-semibold uppercase tracking-wide text-[#3663D8]">
									Contatos autorizados
								</h4>
								<p className="text-sm text-[#6E726E]">
									Cadastre responsáveis para emergências e atualizações.
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleAddContact}
								className="border-[#CBD5F5] text-[#3663D8] hover:bg-[#EEF2FF]"
							>
								<Plus className="mr-2 h-4 w-4" /> Adicionar contato
							</Button>
						</div>

						{formState.contacts.length === 0 ? (
							<p className="rounded-lg border border-dashed border-[#CBD5F5] bg-[#F5F8FF] p-4 text-sm text-[#6E726E]">
								Nenhum contato adicionado no momento.
							</p>
						) : (
							<div className="space-y-4">
								{formState.contacts.map((contact, index) => (
									<div
										key={contact.id}
										className="space-y-4 rounded-lg border border-[#CBD5F5] bg-[#F5F8FF] p-4"
									>
										<div className="flex items-center justify-between">
											<h5 className="text-sm font-semibold text-[#3B3D3B]">
												Contato {index + 1}
											</h5>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => handleRemoveContact(contact.id)}
												className="text-[#6E726E] hover:text-[#1F56B9]"
											>
												<Trash2 className="h-4 w-4" />
												<span className="sr-only">Remover contato {index + 1}</span>
											</Button>
										</div>

										<div className="grid gap-4 md:grid-cols-3">
											<div className="space-y-2">
												<Label htmlFor={`contact-name-${contact.id}`} className="text-sm text-[#3B3D3B]">
													Nome completo
												</Label>
												<Input
													id={`contact-name-${contact.id}`}
													className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
													value={contact.fullName}
													onChange={(event) =>
														handleContactChange(contact.id, "fullName", event.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor={`contact-relation-${contact.id}`} className="text-sm text-[#3B3D3B]">
													Relação
												</Label>
												<Input
													id={`contact-relation-${contact.id}`}
													className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
													value={contact.relation}
													onChange={(event) =>
														handleContactChange(contact.id, "relation", event.target.value)
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor={`contact-phone-${contact.id}`} className="text-sm text-[#3B3D3B]">
													Telefone
												</Label>
												<Input
													id={`contact-phone-${contact.id}`}
													className="border-[#CBD5F5] bg-white focus-visible:border-[#3663D8] focus-visible:ring-2 focus-visible:ring-[#3663D8] focus-visible:ring-opacity-40 placeholder:text-[#8690A7]"
													value={contact.phone}
													onChange={(event) =>
														handleContactChange(contact.id, "phone", event.target.value)
													}
												/>
											</div>
										</div>

										<label className="flex items-center gap-2 text-sm text-[#3B3D3B]">
											<Checkbox
												checked={contact.isPrimary}
												onCheckedChange={(checked) =>
													handleContactChange(contact.id, "isPrimary", checked === true)
												}
											/>
											<span>Contato principal</span>
										</label>
									</div>
								))}
							</div>
						)}
					</section>

					<DialogFooter className="gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={handleClose}
							disabled={isSaving}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={!requiredFieldsValid || isSaving}
							className="bg-[#3663D8] text-white hover:bg-[#2D52B1]"
						>
							{isSaving ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Salvando...
								</>
							) : (
								"Cadastrar paciente"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
