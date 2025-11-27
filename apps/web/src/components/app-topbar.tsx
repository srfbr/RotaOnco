import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BellIcon, Loader2, MenuIcon, SearchIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthSession } from "@/providers/auth-session-provider";
import { toast } from "sonner";
import type { Alert } from "@/features/alerts/api";
import { getAlertSeverityInfo } from "@/features/dashboard/utils";
import { useProfessionalProfile } from "@/features/profile/hooks";

const SEARCH_LIMIT = 5;
const NOTIFICATION_FETCH_LIMIT = 8;
const NOTIFICATIONS_QUERY_KEY = ["notifications", "alerts"] as const;

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
	const isSessionReady = !isLoading && Boolean(session);
	const profileQuery = useProfessionalProfile({ enabled: isSessionReady });
	const profile = profileQuery.data ?? null;
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PatientSummary[]>([]);
	const [isDropdownOpen, setDropdownOpen] = useState(false);
	const [isNotificationsOpen, setNotificationsOpen] = useState(false);
	const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
	const [hasAvatarError, setHasAvatarError] = useState(false);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
	const notificationsPanelRef = useRef<HTMLDivElement | null>(null);

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

	const notificationsQuery = useQuery({
		queryKey: NOTIFICATIONS_QUERY_KEY,
		queryFn: async () => {
			const { data, error } = await apiClient.GET("/alerts", {
				params: { query: { status: "open", limit: NOTIFICATION_FETCH_LIMIT } },
			});
			if (error) {
				throw error;
			}
			return (
				data ?? {
					data: [] as Alert[],
					meta: { total: 0, limit: NOTIFICATION_FETCH_LIMIT, offset: 0 },
				}
			);
		},
		staleTime: 30 * 1000,
		refetchInterval: 2 * 60 * 1000,
	});

	const acknowledgeNotification = useMutation({
		mutationFn: async (alertId: number) => {
			const { error } = await apiClient.PATCH("/alerts/{id}", {
				params: { path: { id: alertId } },
				body: { status: "acknowledged" as const },
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ["dashboard", "alerts"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
		},
	});

	useEffect(() => {
		if (!isNotificationsOpen) {
			return;
		}
		const handleClick = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				!notificationsPanelRef.current?.contains(target) &&
				!notificationsButtonRef.current?.contains(target)
			) {
				setNotificationsOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setNotificationsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isNotificationsOpen]);

	useEffect(() => {
		if (isNotificationsOpen) {
			void notificationsQuery.refetch();
		}
	}, [isNotificationsOpen, notificationsQuery.refetch]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setDropdownOpen(false);
		searchPatients.mutate(query);
	};

	const notifications: Alert[] = (notificationsQuery.data?.data ?? []) as Alert[];
	const unreadCount = notificationsQuery.data?.meta?.total ?? notifications.length;
	const showNotificationBadge = unreadCount > 0;

	const handleNotificationToggle = () => {
		setNotificationsOpen((previous) => !previous);
		setDropdownOpen(false);
	};

	const handleNotificationAcknowledge = async (alertId: number) => {
		setAcknowledgingId(alertId);
		try {
			await acknowledgeNotification.mutateAsync(alertId);
			toast.success("Notificação marcada como lida.");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Não foi possível atualizar a notificação.";
			toast.error(message);
		} finally {
			setAcknowledgingId(null);
		}
	};

	const notificationsStatusText = (() => {
		if (notificationsQuery.isFetching) {
			return "Atualizando notificações";
		}
		if (unreadCount === 0) {
			return "Nenhuma notificação pendente";
		}
		if (unreadCount === 1) {
			return "1 notificação pendente";
		}
		return `${unreadCount} notificações pendentes`;
	})();

	useEffect(() => {
		setHasAvatarError(false);
	}, [profile?.avatarUrl]);

	const userInitials = useMemo(() => {
		const baseName = profile?.fullName || session?.user?.name || "";
		return baseName
			.split(" ")
			.map((part) => part[0]?.toUpperCase())
			.slice(0, 2)
			.join("");
	}, [profile?.fullName, session?.user?.name]);

	const displayName = profile?.fullName ?? session?.user?.name ?? "Usuário";
	const displayEmail = profile?.email ?? session?.user?.email ?? "";
	const secondaryText = displayEmail || profile?.roleLabel || "";
	const showSkeleton = isLoading || (isSessionReady && profileQuery.isLoading && !profile);
	const showAvatarImage = Boolean(profile?.avatarUrl) && !hasAvatarError;

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
					onClick={handleNotificationToggle}
					ref={notificationsButtonRef}
					aria-expanded={isNotificationsOpen}
					aria-haspopup="true"
					aria-label={isNotificationsOpen ? "Fechar central de notificações" : "Abrir central de notificações"}
				>
					<BellIcon className="h-5 w-5 text-[#AAAAAA]" />
					{showNotificationBadge ? (
						<span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF3B3B]" />
					) : null}
				</Button>

					{showSkeleton ? (
					<div className="flex items-center gap-3">
						<Skeleton className="h-10 w-10 rounded-full" />
						<div className="space-y-1">
							<Skeleton className="h-3 w-28" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				) : (
					<div className="flex items-center gap-3">
							{showAvatarImage ? (
								<img
									src={profile?.avatarUrl ?? ""}
									alt={`Foto de ${displayName}`}
									className="h-10 w-10 rounded-full object-cover"
									onError={() => setHasAvatarError(true)}
									loading="lazy"
								/>
							) : (
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D9D9D9] text-sm font-semibold text-[#404040]">
									{userInitials || "??"}
								</div>
							)}
						<div className="flex flex-col">
								<span className="text-sm font-semibold text-[#404040]">{displayName}</span>
								<span className="text-xs font-medium text-[#565656]">{secondaryText}</span>
						</div>
					</div>
				)}
			</div>

			{isNotificationsOpen && (
				<div
					ref={notificationsPanelRef}
					className="absolute right-6 top-16 z-50 w-[360px] rounded-xl border border-[#E5E5E5] bg-white shadow-xl"
				>
					<header className="flex items-start justify-between gap-3 border-b border-[#E5E5E5] px-5 py-4">
						<div>
							<p className="text-sm font-semibold text-[#1F2937]">Central de notificações</p>
							<p className="text-xs text-[#6B7280]">{notificationsStatusText}</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 gap-2 text-[#2563EB]"
							onClick={() => void notificationsQuery.refetch()}
							disabled={notificationsQuery.isFetching}
						>
							{notificationsQuery.isFetching ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							Atualizar
						</Button>
					</header>
					<div className="max-h-80 space-y-3 overflow-y-auto px-5 py-4">
						{notificationsQuery.isLoading ? (
							<NotificationSkeletonList />
						) : notificationsQuery.isError ? (
							<NotificationErrorState
								message={
									notificationsQuery.error instanceof Error
										? notificationsQuery.error.message
										: "Não foi possível carregar as notificações."
								}
								onRetry={() => void notificationsQuery.refetch()}
							/>
						) : notifications.length === 0 ? (
							<p className="text-sm text-[#6B7280]">Nenhuma notificação pendente no momento.</p>
						) : (
							notifications.map((alert) => {
								const severity = getAlertSeverityInfo(alert);
								const isPending = acknowledgeNotification.isPending && acknowledgingId === alert.id;
								return (
									<article key={alert.id} className="rounded-lg border border-[#E5E5E5] p-4">
										<header className="mb-2 flex items-start justify-between gap-3">
											<div>
												<p className="text-sm font-semibold text-[#1F2937]">
													{formatAlertKind(alert.kind)}
												</p>
												<p className="text-xs text-[#6B7280]">
													Paciente #{alert.patientId} · {formatNotificationDate(alert.createdAt)}
												</p>
											</div>
											<span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-semibold ${severity.className}`}>
												{severity.label}
											</span>
										</header>
										<p
											className="mb-3 text-xs leading-5 text-[#4B5563]"
											title={alert.details?.trim() || "Alerta registrado sem detalhes adicionais."}
											style={{
												display: "-webkit-box",
												WebkitLineClamp: 3,
												WebkitBoxOrient: "vertical",
												overflow: "hidden",
											}}
										>
											{alert.details?.trim() || "Alerta registrado sem detalhes adicionais."}
										</p>
										<div className="flex flex-wrap items-center gap-3">
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-8 gap-2 border-[#C8C8C8] text-xs text-[#2563EB] hover:bg-[#F3F4F6]"
												onClick={() => {
													setNotificationsOpen(false);
													navigate({
														to: "/alerts/$alertId",
														params: { alertId: String(alert.id) },
													});
												}}
											>
												Ver detalhes
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 gap-2 px-0 text-xs text-[#EF4444]"
												onClick={() => void handleNotificationAcknowledge(alert.id)}
												disabled={isPending}
											>
												{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
												Marcar como lida
											</Button>
										</div>
									</article>
								);
							})
						)}
					</div>
				</div>
			)}

			{isDropdownOpen && results.length > 0 && (
				<div className="absolute left-6 top-16 z-40 w-[380px] rounded-lg border border-[#CECFCD] bg-white p-4 shadow-lg">
					<p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
						Pacientes encontrados
					</p>
					<ul className="space-y-2">
						{results.map((patient) => (
							<li key={patient.id}>
								<button
									type="button"
									onClick={() => {
										setDropdownOpen(false);
										setResults([]);
										navigate({
											to: "/patients",
											search: {
												q: query.trim(),
												stage: "all",
												status: "all",
												page: 1,
												selectedPatientId: patient.id,
											},
										});
									}}
									className="w-full rounded-md border border-transparent px-2 py-1 text-left hover:border-[#2563EB]/40"
								>
									<span className="block text-sm font-medium text-[#111827]">
										{patient.fullName}
									</span>
									<span className="block text-xs text-[#6B7280]">
										CPF: {patient.cpf}
									</span>
								</button>
							</li>
						))}
					</ul>
					<Button
						type="button"
						variant="link"
						className="mt-3 px-0 text-sm text-[#2563EB]"
						onClick={() => {
							setDropdownOpen(false);
							navigate({
								to: "/patients",
								search: {
									q: query.trim(),
									stage: "all",
									status: "all",
									page: 1,
								},
							});
						}}
					>
						Ver todos
					</Button>
				</div>
			)}
		</header>
	);
}

function NotificationSkeletonList() {
	return (
		<div className="space-y-3">
			{Array.from({ length: 3 }).map((_, index) => (
				<div key={index} className="rounded-lg border border-[#E5E5E5] p-4">
					<div className="mb-3 space-y-2">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-28" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-3/4" />
					</div>
					<div className="mt-3 flex gap-2">
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-28" />
					</div>
				</div>
			))}
		</div>
	);
}

function NotificationErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="space-y-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
			<p>{message}</p>
			<Button
				type="button"
				variant="link"
				size="sm"
				className="px-0 text-[#2563EB]"
				onClick={onRetry}
			>
				Tentar novamente
			</Button>
		</div>
	);
}

function formatAlertKind(kind: string) {
	if (!kind.trim()) {
		return "Não informado";
	}
	return kind
		.replace(/[-_]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNotificationDate(iso?: string | null) {
	if (!iso) {
		return "Data indisponível";
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "Data indisponível";
	}
	return date.toLocaleString("pt-BR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
