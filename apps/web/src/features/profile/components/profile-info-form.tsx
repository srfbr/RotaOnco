import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode, type HTMLInputTypeAttribute } from "react";
import type { ProfileViewModel } from "../types";
import type { ProfessionalProfileUpdateInput } from "../api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, UserRound, Stethoscope, IdCard, Phone, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

const FIELD_ICON_CLASS = "h-4 w-4 text-[#9CA3AF]";

type ProfileInfoFormProps = {
	profile?: ProfileViewModel | null;
	isLoading: boolean;
	onSubmit: (payload: ProfessionalProfileUpdateInput) => Promise<void>;
	isSubmitting: boolean;
};

type FormState = ReturnType<typeof createFormState>;

export function ProfileInfoForm({ profile, isLoading, onSubmit, isSubmitting }: ProfileInfoFormProps) {
	const [formState, setFormState] = useState<FormState>(() => createFormState(profile));

	useEffect(() => {
		setFormState(createFormState(profile));
	}, [profile?.id, profile?.updatedAt]);

	const handleChange = (field: keyof typeof formState) =>
		(event: ChangeEvent<HTMLInputElement>) => {
			setFormState((prev) => ({ ...prev, [field]: event.target.value }));
		};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!profile) {
			return;
		}

		const payload = buildUpdatePayload(formState, profile);
		if (Object.keys(payload).length === 0) {
			toast.info("Nenhuma alteração para salvar.");
			return;
		}

		await onSubmit(payload);
	};

	const isDisabled = isLoading || !profile || isSubmitting;

	return (
		<section className="flex flex-1 flex-col gap-6 rounded-xl border border-[#E5E5E5] bg-white p-8">
			<header className="space-y-1">
				<h2 className="text-2xl font-bold text-[#3B3D3B]">Suas informações</h2>
				<p className="text-sm text-[#6E726E]">Altere telefone, senha e demais dados pessoais.</p>
			</header>

			<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
				<div className="grid gap-4">
					<Field label="Nome completo" icon={<UserRound className={FIELD_ICON_CLASS} />}
						value={formState.fullName}
						onChange={handleChange("fullName")}
						disabled={isDisabled}
					/>
					<Field label="Especialidade" icon={<Stethoscope className={FIELD_ICON_CLASS} />}
						value={formState.specialty}
						onChange={handleChange("specialty")}
						disabled={isDisabled}
					/>
					<Field label="Documento" icon={<IdCard className={FIELD_ICON_CLASS} />}
						value={formState.document}
						onChange={handleChange("document")}
						disabled
					/>
					<Field label="Telefone" icon={<Phone className={FIELD_ICON_CLASS} />}
						value={formState.phone}
						onChange={handleChange("phone")}
						disabled={isDisabled}
					/>
					<Field label="Senha" type="password" icon={<Lock className={FIELD_ICON_CLASS} />}
						value={formState.password}
						onChange={handleChange("password")}
						disabled
					/>
					<Field label="E-mail" type="email" icon={<Mail className={FIELD_ICON_CLASS} />}
						value={formState.email}
						onChange={handleChange("email")}
						disabled
					/>
				</div>

				<div className="flex justify-end">
					<Button
						type="submit"
						className="gap-2 bg-[#3663D8] text-white hover:bg-[#2D52B1]"
						disabled={isDisabled}
					>
						{isSubmitting ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Salvando...
							</>
						) : (
							"Atualizar dados"
						)}
					</Button>
				</div>
			</form>
		</section>
	);
}

function Field({
	label,
	icon,
	type = "text",
	value,
	onChange,
	disabled = false,
}: {
	label: string;
	icon: ReactNode;
	type?: HTMLInputTypeAttribute;
	value: string;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	disabled?: boolean;
}) {
	return (
		<label className="space-y-2 text-sm">
			<span className="block text-[#6E726E]">{label}</span>
			<div className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3">
				{icon}
				<Input
					type={type}
					value={value}
					onChange={onChange}
					disabled={disabled}
					className="border-0 p-0 text-[#3B3D3B] focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent"
				/>
			</div>
		</label>
	);
}

function createFormState(profile?: ProfileViewModel | null) {
	return {
		fullName: profile?.fullName ?? "",
		specialty: profile?.specialty ?? "",
		document: profile?.documentId ?? "",
		phone: profile?.phone ?? "",
		password: "************",
		email: profile?.email ?? "",
	};
}

function buildUpdatePayload(formState: FormState, profile: ProfileViewModel): ProfessionalProfileUpdateInput {
	const payload: ProfessionalProfileUpdateInput = {};

	const trimmedName = formState.fullName.trim();
	if (trimmedName.length > 0 && trimmedName !== profile.fullName) {
		payload.name = trimmedName;
	}

	const normalizedSpecialty = normalizeOptionalValue(formState.specialty);
	if ((normalizedSpecialty ?? null) !== (profile.specialty ?? null)) {
		payload.specialty = normalizedSpecialty ?? null;
	}

	const normalizedPhone = normalizeOptionalValue(formState.phone);
	if ((normalizedPhone ?? null) !== (profile.phone ?? null)) {
		payload.phone = normalizedPhone ?? null;
	}

	return payload;
}

function normalizeOptionalValue(raw: string) {
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
