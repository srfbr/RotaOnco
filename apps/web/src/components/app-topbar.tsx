import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { BellIcon, MenuIcon, SearchIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthSession } from "@/providers/auth-session-provider";
import { toast } from "sonner";

const SEARCH_LIMIT = 5;

type PatientSummary = {
	id: number;
	fullName: string;
	cpf: string;
	stage?: string | null;
	status?: string | null;
};

type AppTopbarProps = {
	isSidebarCollapsed?: boolean;
	onToggleSidebar?: () => void;
};

export function AppTopbar({ isSidebarCollapsed = false, onToggleSidebar }: AppTopbarProps) {
	const { session, isLoading } = useAuthSession();
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PatientSummary[]>([]);
	const [isDropdownOpen, setDropdownOpen] = useState(false);

	const searchPatients = useMutation({
		mutationFn: async (term: string) => {
			const trimmed = term.trim();
			if (!trimmed) {
				return [] as PatientSummary[];
			}
			const { data, error } = await apiClient.GET("/patients/search", {
				params: {
					query: {
						q: trimmed,
						limit: SEARCH_LIMIT,
					},
				},
			});
			if (error) {
				throw error;
			}
			return data ?? [];
		},
		onSuccess: (data) => {
			setResults(data ?? []);
			setDropdownOpen(true);
			if (!data || data.length === 0) {
				toast.info("Nenhum paciente encontrado");
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Não foi possível buscar pacientes");
		},
	});

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setDropdownOpen(false);
		searchPatients.mutate(query);
	};

	const userInitials = useMemo(() => {
		if (!session?.user?.name) return "";
		return session.user.name
			.split(" ")
			.map((part) => part[0]?.toUpperCase())
			.slice(0, 2)
			.join("");
	}, [session?.user?.name]);

	return (
		<header className="relative flex h-20 items-center justify-between border-b border-[#CECFCD] bg-white px-6">
			<div className="flex items-center gap-4">
				{onToggleSidebar ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-11 w-11 text-[#565656]"
						onClick={() => onToggleSidebar()}
						aria-controls="app-sidebar"
						aria-expanded={!isSidebarCollapsed}
						aria-label={isSidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
					>
						<MenuIcon className="h-5 w-5" />
					</Button>
				) : null}
				<form className="relative flex w-[380px] items-center" onSubmit={handleSubmit}>
					<Input
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							if (isDropdownOpen) {
								setDropdownOpen(false);
							}
						}}
						placeholder="Buscar pacientes"
						className="h-11 rounded-full border border-[#C8C8C8] pl-11 pr-4 text-sm text-[#111827] placeholder:text-[#CECFCD] focus-visible:ring-0"
					/>
					<SearchIcon className="absolute left-4 h-4 w-4 text-[#AAAAAA]" />
				</form>
			</div>

			<div className="flex items-center gap-6">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="relative h-10 w-10 rounded-full border border-[#C8C8C8]"
					onClick={() => toast.info("Central de notificações em breve")}
				>
					<BellIcon className="h-5 w-5 text-[#AAAAAA]" />
					<span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF3B3B]" />
				</Button>

				{isLoading ? (
					<div className="flex items-center gap-3">
						<Skeleton className="h-10 w-10 rounded-full" />
						<div className="space-y-1">
							<Skeleton className="h-3 w-28" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				) : (
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D9D9D9] text-sm font-semibold text-[#404040]">
							{userInitials || "??"}
						</div>
						<div className="flex flex-col">
							<span className="text-sm font-semibold text-[#404040]">
								{session?.user?.name || "Usuário"}
							</span>
							<span className="text-xs font-medium text-[#565656]">
								{session?.user?.email ?? ""}
							</span>
						</div>
					</div>
				)}
			</div>

			{isDropdownOpen && results.length > 0 && (
				<div className="absolute left-6 top-16 z-40 w-[380px] rounded-lg border border-[#CECFCD] bg-white p-4 shadow-lg">
					<p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
						Pacientes encontrados
					</p>
					<ul className="space-y-2">
						{results.map((patient) => (
							<li key={patient.id} className="flex flex-col rounded-md border border-transparent px-2 py-1 hover:border-[#2563EB]/40">
								<span className="text-sm font-medium text-[#111827]">
									{patient.fullName}
								</span>
								<span className="text-xs text-[#6B7280]">
									CPF: {patient.cpf}
								</span>
							</li>
						))}
					</ul>
					<Button
						type="button"
						variant="link"
						className="mt-3 px-0 text-sm text-[#2563EB]"
						onClick={() => {
							setDropdownOpen(false);
							toast.info("Listagem completa de pacientes em breve");
						}}
					>
						Ver todos
					</Button>
				</div>
			)}
		</header>
	);
}
