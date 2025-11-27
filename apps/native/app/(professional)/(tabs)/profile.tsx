import { Container } from "@/components/container";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "@/lib/auth-client";
import { fetchProfessionalProfile } from "@/lib/api";
import { useRouter } from "expo-router";
import {
	ActivityIndicator,
	Alert,
	Image,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function getInitials(name?: string | null) {
	if (!name) {
		return "?";
	}
	const trimmed = name.trim();
	if (!trimmed) {
		return "?";
	}
	const parts = trimmed.split(/\s+/);
	if (parts.length === 1) {
		return parts[0][0]?.toUpperCase() ?? "?";
	}
	const first = parts[0][0] ?? "";
	const last = parts[parts.length - 1][0] ?? "";
	return `${first}${last}`.toUpperCase() || "?";
}

function formatDocument(documentId?: string | null) {
	if (!documentId) {
		return "Não informado";
	}
	const digits = documentId.replace(/\D/g, "");
	if (digits.length === 11) {
		return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
	}
	return documentId;
}

function formatPhone(phone?: string | null) {
	if (!phone) {
		return "Não informado";
	}
	const digits = phone.replace(/\D/g, "");
	if (digits.length === 11) {
		return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
	}
	if (digits.length === 10) {
		return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
	}
	return phone;
}

function formatDate(value?: string | null) {
	if (!value) {
		return "-";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	}).format(date);
}

function formatRole(role: string) {
	switch (role) {
		case "admin":
			return "Administrador";
		case "professional":
			return "Profissional";
		default:
			return role;
	}
}

const ProfessionalProfileScreen = () => {
	const router = useRouter();
	const editProfileRoute = "/(professional)/edit-profile" as const;
	const session = authClient.useSession();
	const isAuthenticated = Boolean(session.data);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const queryClient = useQueryClient();

	const {
		data: profile,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: ["professional", "profile"],
		queryFn: fetchProfessionalProfile,
		enabled: isAuthenticated,
		staleTime: 5 * 60 * 1000,
	});

	const initials = useMemo(() => getInitials(profile?.name), [profile?.name]);
	const rolesLabel = useMemo(() => {
		if (!profile?.roles || profile.roles.length === 0) {
			return "-";
		}
		return profile.roles.map((role) => formatRole(role)).join(", ");
	}, [profile?.roles]);
	const statusLabel = profile?.isActive ? "Ativo" : "Inativo";
	const errorMessage = error instanceof Error ? error.message : "Não foi possível carregar o perfil.";

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true);
		refetch().finally(() => setIsRefreshing(false));
	}, [refetch]);

	const handleLogout = useCallback(async () => {
		if (isSigningOut) {
			return;
		}
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			queryClient.clear();
			router.replace("/(drawer)/professional-login");
		} catch (logoutError) {
			const message = logoutError instanceof Error
				? logoutError.message || "Não foi possível encerrar a sessão. Tente novamente."
				: "Não foi possível encerrar a sessão. Tente novamente.";
			Alert.alert("Erro ao sair", message);
			setIsSigningOut(false);
		}
	}, [isSigningOut, queryClient, router]);

	return (
		<Container>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						colors={["#2563EB"]}
						progressBackgroundColor="#FFFFFF"
					/>
				}
			>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						activeOpacity={0.8}
						onPress={() => router.replace("/(professional)/(tabs)")}
					>
						<Ionicons name="arrow-back" size={22} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Meu perfil</Text>
				</View>

				{isLoading ? (
					<View style={styles.loadingState}>
						<ActivityIndicator size="small" color="#2563EB" />
						<Text style={styles.loadingText}>Carregando informações do perfil...</Text>
					</View>
				) : isError ? (
					<View style={styles.errorState}>
						<Ionicons name="warning" size={20} color="#B91C1C" />
						<Text style={styles.errorText}>{errorMessage}</Text>
						<TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => refetch()}>
							<Text style={styles.retryButtonText}>Tentar novamente</Text>
						</TouchableOpacity>
					</View>
				) : profile ? (
					<>
						<View style={styles.profileCard}>
							<View style={styles.avatar}>
								{profile.avatarUrl ? (
									<Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
								) : (
									<Text style={styles.avatarInitials}>{initials}</Text>
								)}
							</View>
							<Text style={styles.profileName}>{profile.name}</Text>
							<Text style={styles.profileMeta}>{profile.specialty?.trim() || "Especialidade não informada"}</Text>
							<View style={[styles.statusBadge, profile.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
								<Text style={profile.isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive}>{statusLabel}</Text>
							</View>
						</View>

						<View style={styles.infoSection}>
							<Text style={styles.infoSectionTitle}>Informações profissionais</Text>
							<View style={styles.infoCard}>
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>Nome completo</Text>
									<Text style={styles.infoValue}>{profile.name || "-"}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>E-mail</Text>
									<Text style={styles.infoValue}>{profile.email || "Não informado"}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>CPF</Text>
									<Text style={styles.infoValue}>{formatDocument(profile.documentId)}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>Telefone</Text>
									<Text style={styles.infoValue}>{formatPhone(profile.phone)}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>Especialidade</Text>
									<Text style={styles.infoValue}>{profile.specialty?.trim() || "Não informada"}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>Funções</Text>
									<Text style={styles.infoValue}>{rolesLabel}</Text>
								</View>
							</View>
						</View>

						<View style={styles.infoSection}>
							<Text style={styles.infoSectionTitle}>Dados da conta</Text>
							<View style={styles.infoCard}>
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>ID interno</Text>
									<Text style={styles.infoValue}>{profile.id}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>Criado em</Text>
									<Text style={styles.infoValue}>{formatDate(profile.createdAt)}</Text>
								</View>
								<View style={styles.infoDivider} />
								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>Atualizado em</Text>
									<Text style={styles.infoValue}>{formatDate(profile.updatedAt)}</Text>
								</View>
							</View>
						</View>

						<View style={styles.actionList}>
							<TouchableOpacity
								style={styles.actionItem}
								activeOpacity={0.85}
								onPress={() => router.push(editProfileRoute as never)}
							>
								<View style={styles.actionInfo}>
									<Ionicons name="person" size={20} color="#111827" />
									<Text style={styles.actionText}>Editar perfil</Text>
								</View>
								<Ionicons name="chevron-forward" size={18} color="#CBD5F5" />
							</TouchableOpacity>

							<View style={styles.divider} />

							<TouchableOpacity
								style={[styles.actionItem, isSigningOut && styles.actionItemDisabled]}
								activeOpacity={0.85}
								onPress={handleLogout}
								disabled={isSigningOut}
							>
								<View style={styles.actionInfo}>
									<Ionicons name="log-out" size={20} color="#DC2626" />
									<Text style={[styles.actionText, styles.logoutText]}>
										{isSigningOut ? "Saindo..." : "Sair"}
									</Text>
								</View>
								{isSigningOut ? <ActivityIndicator size="small" color="#DC2626" /> : null}
							</TouchableOpacity>
						</View>
					</>
				) : (
					<View style={styles.emptyPlaceholder}>
						<Text style={styles.emptyPlaceholderText}>Perfil não disponível.</Text>
					</View>
				)}
			</ScrollView>
		</Container>
	);
};

const styles = StyleSheet.create({
	scroll: {
		flex: 1,
		paddingHorizontal: 20,
	},
	content: {
		paddingBottom: 48,
		gap: 24,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		paddingTop: 12,
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		flex: 1,
		fontSize: 22,
		fontWeight: "700",
		color: "#111827",
		textAlign: "center",
		marginRight: 40,
	},
	loadingState: {
		marginTop: 48,
		alignItems: "center",
		gap: 12,
	},
	loadingText: {
		fontSize: 14,
		color: "#475569",
	},
	errorState: {
		marginTop: 40,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#FCA5A5",
		backgroundColor: "#FEF2F2",
		padding: 20,
		alignItems: "center",
		gap: 12,
	},
	errorText: {
		fontSize: 14,
		color: "#991B1B",
		textAlign: "center",
		lineHeight: 20,
	},
	retryButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 12,
		backgroundColor: "#1D4ED8",
	},
	retryButtonText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	profileCard: {
		alignItems: "center",
		gap: 12,
	},
	avatar: {
		width: 120,
		height: 120,
		borderRadius: 60,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#2563EB",
		overflow: "hidden",
	},
	avatarImage: {
		width: "100%",
		height: "100%",
		borderRadius: 60,
	},
	avatarInitials: {
		fontSize: 42,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	profileName: {
		fontSize: 20,
		fontWeight: "700",
		color: "#111827",
		textAlign: "center",
	},
	profileMeta: {
		fontSize: 14,
		color: "#475569",
		textAlign: "center",
	},
	statusBadge: {
		marginTop: 4,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
	},
	statusBadgeActive: {
		backgroundColor: "#DCFCE7",
	},
	statusBadgeInactive: {
		backgroundColor: "#FEE2E2",
	},
	statusBadgeTextActive: {
		fontSize: 12,
		fontWeight: "600",
		color: "#166534",
		textTransform: "uppercase",
	},
	statusBadgeTextInactive: {
		fontSize: 12,
		fontWeight: "600",
		color: "#B91C1C",
		textTransform: "uppercase",
	},
	infoSection: {
		gap: 12,
	},
	infoSectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#111827",
	},
	infoCard: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		paddingHorizontal: 16,
		paddingVertical: 14,
		gap: 12,
		backgroundColor: "#FFFFFF",
	},
	infoRow: {
		gap: 4,
	},
	infoLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: "#64748B",
		textTransform: "uppercase",
	},
	infoValue: {
		fontSize: 15,
		color: "#1F2937",
		fontWeight: "500",
	},
	infoDivider: {
		height: 1,
		backgroundColor: "#E2E8F0",
	},
	actionList: {
		gap: 12,
	},
	actionItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		paddingHorizontal: 16,
		paddingVertical: 14,
		backgroundColor: "#FFFFFF",
	},
	actionInfo: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	actionText: {
		fontSize: 15,
		fontWeight: "500",
		color: "#111827",
	},
	logoutText: {
		color: "#DC2626",
		fontWeight: "600",
	},
	actionItemDisabled: {
		opacity: 0.6,
	},
	divider: {
		height: 1,
		backgroundColor: "#E2E8F0",
		marginHorizontal: 4,
	},
	emptyPlaceholder: {
		marginTop: 40,
		alignItems: "center",
	},
	emptyPlaceholderText: {
		fontSize: 14,
		color: "#475569",
	},
});

export default ProfessionalProfileScreen;
