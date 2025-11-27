import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileViewModel } from "../types";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ProfileOverviewCardProps = {
	profile?: ProfileViewModel | null;
	isLoading: boolean;
	onAvatarUpdate?: (avatarDataUrl: string) => Promise<void>;
	isUpdating?: boolean;
};

export function ProfileOverviewCard({ profile, isLoading, onAvatarUpdate, isUpdating = false }: ProfileOverviewCardProps) {
	const initials = getInitials(profile?.fullName ?? "");
	const roleLabel = profile?.roleLabel ?? "Usuário";
	const formattedDocument = formatDocument(profile?.documentId);
	const formattedPhone = formatPhone(profile?.phone);
	const [hasImageError, setHasImageError] = useState(false);
	const avatarUrl = profile?.avatarUrl ?? null;
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		setHasImageError(false);
	}, [avatarUrl]);

	const shouldShowAvatarImage = Boolean(avatarUrl) && !hasImageError && !isLoading;
	const isBusy = isLoading || isUpdating;
	const isAvatarDisabled = isBusy || !onAvatarUpdate;

	const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		event.target.value = "";
		if (!file) {
			return;
		}

		if (!onAvatarUpdate) {
			toast.error("Funcionalidade de atualização de foto indisponível.");
			return;
		}

		if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
			toast.error("Escolha uma imagem nos formatos PNG, JPG ou WEBP.");
			return;
		}

		if (file.size > 2 * 1024 * 1024) {
			toast.error("Imagem deve ter no máximo 2MB.");
			return;
		}

		try {
			const dataUrl = await fileToDataUrl(file);
			setHasImageError(false);
			await onAvatarUpdate(dataUrl);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Não foi possível atualizar a foto.";
			toast.error(message);
		}
	};

	return (
		<section className="flex flex-col gap-6">
			<article className="flex flex-col items-center gap-6 rounded-xl border border-[#E5E5E5] bg-white p-8">
				<div className="relative">
					<div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-[#E8EEFF] text-3xl font-semibold text-[#3663D8] sm:size-40">
						{isLoading ? (
							<Skeleton className="h-full w-full rounded-full" />
						) : shouldShowAvatarImage ? (
							<img
								src={avatarUrl ?? ""}
								alt={`Foto de ${profile?.fullName ?? "profissional"}`}
								className="size-full object-cover"
								onError={() => setHasImageError(true)}
							/>
						) : (
							initials || "??"
						)}
					</div>
					{isUpdating ? (
						<div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/80">
							<Loader2 className="h-6 w-6 animate-spin text-[#3663D8]" />
						</div>
					) : null}
					<Button
						type="button"
						size="icon"
						variant="secondary"
						className="absolute bottom-0 right-0 h-9 w-9 rounded-full border border-[#CBD5F5] bg-white text-[#3663D8] shadow-md"
						disabled={isAvatarDisabled}
						onClick={() => {
							if (isAvatarDisabled) return;
							fileInputRef.current?.click();
						}}
					>
						<Camera className="h-4 w-4" />
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/png,image/jpeg,image/webp"
						className="sr-only"
						onChange={handleFileSelection}
					/>
				</div>
				<p className="text-xs text-[#6E726E]">Formatos aceitos: PNG, JPG ou WEBP (até 2MB)</p>
				<div className="text-center">
					{isLoading ? (
						<>
							<Skeleton className="mx-auto mb-2 h-6 w-44" />
							<Skeleton className="mx-auto h-4 w-28" />
						</>
					) : (
						<>
							<h2 className="text-2xl font-semibold text-[#3B3D3B]">
								{profile?.fullName ?? "Usuário"}
							</h2>
							<p className="text-sm text-[#6E726E]">{roleLabel}</p>
						</>
					)}
				</div>
			</article>

			<article className="space-y-6 rounded-xl border border-[#E5E5E5] bg-white p-6">
				<header>
					<h3 className="text-lg font-semibold text-[#3B3D3B]">Informações principais</h3>
					<p className="text-sm text-[#6E726E]">Resumo rápido dos dados profissionais.</p>
				</header>
				<ul className="space-y-4 text-sm text-[#4B5563]">
					<OverviewItem label="Nome" value={profile?.fullName} isLoading={isLoading} />
					<OverviewItem label="Especialidade" value={profile?.specialty} isLoading={isLoading} />
					<OverviewItem label="Documento" value={formattedDocument} isLoading={isLoading} />
					<OverviewItem label="E-mail" value={profile?.email} isLoading={isLoading} />
					<OverviewItem label="Telefone" value={formattedPhone} isLoading={isLoading} />
					<OverviewItem
						label="Status"
						value={profile ? (profile.isActive ? "Ativo" : "Inativo") : undefined}
						isLoading={isLoading}
					/>
				</ul>
			</article>
		</section>
	);
}

function getInitials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}

function formatDocument(documentId?: string) {
	if (!documentId) {
		return "Não informado";
	}
	const digits = documentId.replace(/\D/g, "");
	if (digits.length === 11) {
		return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
	}
	return documentId;
}

function formatPhone(raw?: string | null) {
	if (!raw) {
		return "Não informado";
	}
	const digits = raw.replace(/\D/g, "");
	if (digits.length === 11) {
		return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
	}
	if (digits.length === 10) {
		return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
	}
	return raw;
}

function OverviewItem({ label, value, isLoading }: { label: string; value?: string | null; isLoading: boolean }) {
	return (
		<li>
			<span className="font-medium text-[#6E726E]">{label}:</span>{" "}
			{isLoading ? (
				<Skeleton className="inline-block h-3 w-32 align-middle" />
			) : value && value.trim().length > 0 ? (
				value
			) : (
				"Não informado"
			)}
		</li>
	);
}

async function fileToDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
			} else {
				reject(new Error("Falha ao ler o arquivo selecionado."));
			}
		};
		reader.onerror = () => {
			reject(new Error("Não foi possível processar a imagem."));
		};
		reader.readAsDataURL(file);
	});
}
