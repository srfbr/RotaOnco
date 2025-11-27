import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import {
	acknowledgeAlert,
	fetchPatientSummaryById,
	fetchProfessionalAlerts,
	fetchProfessionalProfile,
	searchPatients,
	type Alert,
	type AlertSeverity,
	type PatientSummary,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	ActivityIndicator,
	Keyboard,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useRouter } from "expo-router";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const SHORTCUTS: Array<{
	id: string;
	title: string;
	description: string;
	icon: IoniconName;
	accent: string;
}> = [
	{
		id: "appointments",
		title: "Meus atendimentos",
		description: "Veja seus próximos atendimentos do dia.",
		icon: "people",
		accent: "#1D4ED8",
	},
	{
		id: "patients",
		title: "Meus pacientes",
		description: "Todos os seus pacientes em um só lugar.",
		icon: "people-circle",
		accent: "#1D4ED8",
	},
	{
		id: "schedule",
		title: "Gerenciar agenda",
		description: "Organize consultas, plantões e bloqueios.",
		icon: "calendar",
		accent: "#1D4ED8",
	},
	{
		id: "reports",
		title: "Relatórios",
		description: "Acompanhe indicadores e evolução dos casos.",
		icon: "document-text",
		accent: "#1D4ED8",
	},
];

const ProfessionalHomeScreen = () => {
	const router = useRouter();
	const appointmentsRoute = "/(professional)/appointments" as const;
	const patientsRoute = "/(professional)/patients" as const;
	const scheduleRoute = "/(professional)/(tabs)/schedule" as const;
	const sessionState = authClient.useSession();
	const isAuthenticated = Boolean(sessionState.data);
	const [searchTerm, setSearchTerm] = useState("");
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const profileQuery = useQuery({
		queryKey: ["professional", "profile"],
		queryFn: fetchProfessionalProfile,
		enabled: isAuthenticated,
		staleTime: 5 * 60 * 1000,
	});

	const alertsQuery = useQuery({
		queryKey: ["professional", "alerts", { status: "open", limit: 4 }],
		queryFn: () => fetchProfessionalAlerts({ status: "open", limit: 4 }),
		enabled: isAuthenticated,
		staleTime: 30 * 1000,
	});

	const profile = profileQuery.data;
	const firstName = useMemo(() => {
		if (!profile?.name) {
			return null;
		}
		const trimmed = profile.name.trim();
		if (!trimmed) {
			return null;
		}
		return trimmed.split(" ")[0] ?? trimmed;
	}, [profile?.name]);

	const isProfileLoading = sessionState.isPending || profileQuery.isLoading;
	const greeting = isProfileLoading
		? "Olá 👋"
		: `Olá, ${firstName ?? profile?.name ?? "profissional"} 👋`;
	const greetingSubtitle = isProfileLoading
		? "Preparando sua agenda..."
		: "Como você está hoje?";

	const alerts = alertsQuery.data?.data ?? [];
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [isAlertModalVisible, setAlertModalVisible] = useState(false);
	const [isAcknowledgingAlert, setIsAcknowledgingAlert] = useState(false);
	const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
	const alertPatientIds = useMemo(() => {
		if (alerts.length === 0) {
			return [] as number[];
		}
		const uniqueIds = Array.from(new Set(alerts.map((alert) => alert.patientId)));
		uniqueIds.sort((a, b) => a - b);
		return uniqueIds;
	}, [alerts]);

	const alertPatientsQuery = useQuery({
		queryKey: ["professional", "alerts", "patients", alertPatientIds],
		queryFn: async () => {
			const entries = await Promise.all(
				alertPatientIds.map(async (id) => {
					const summary = await fetchPatientSummaryById(id);
					return [id, summary?.fullName ?? null] as const;
				}),
			);
			return Object.fromEntries(entries) as Record<number, string | null>;
		},
		enabled: alertPatientIds.length > 0,
		staleTime: 5 * 60 * 1000,
	});
	const isAlertsLoading = sessionState.isPending || alertsQuery.isLoading;
	const alertsErrorMessage = alertsQuery.error instanceof Error
		? alertsQuery.error.message
		: null;

	const selectedAlertPatientName = selectedAlert
		? alertPatientsQuery.data?.[selectedAlert.patientId] ?? null
		: null;
	const selectedAlertAccent = selectedAlert ? getSeverityAccent(selectedAlert.severity) : "#2563EB";
	const selectedAlertIcon = selectedAlert ? getSeverityIcon(selectedAlert.severity) : "information-circle";
	const selectedAlertDetails = selectedAlert?.details?.trim()
		? selectedAlert.details.trim()
		: "Sem detalhes adicionais.";
	const selectedAlertSeverityLabel = selectedAlert ? formatAlertSeverity(selectedAlert.severity) : null;

	const openAlertModal = (alert: Alert) => {
		setSelectedAlert(alert);
		setAcknowledgeError(null);
		setAlertModalVisible(true);
	};

	const closeAlertModal = () => {
		if (isAcknowledgingAlert) {
			return;
		}
		setAlertModalVisible(false);
		setSelectedAlert(null);
		setAcknowledgeError(null);
	};

	const handleConfirmAlert = async () => {
		if (!selectedAlert) {
			return;
		}
		setIsAcknowledgingAlert(true);
		setAcknowledgeError(null);
		try {
			await acknowledgeAlert(selectedAlert.id);
			await alertsQuery.refetch();
			setAlertModalVisible(false);
			setSelectedAlert(null);
		} catch (error) {
			const message = error instanceof Error
				? error.message
				: "Não foi possível confirmar a leitura do alerta.";
			setAcknowledgeError(message);
		} finally {
			setIsAcknowledgingAlert(false);
		}
	};

	const trimmedSearch = searchTerm.trim();
	const patientsSearchQuery = useQuery({
		queryKey: ["professional", "patients", "search", trimmedSearch],
		queryFn: () => searchPatients(trimmedSearch, 10),
		enabled: trimmedSearch.length >= 2,
		staleTime: 30 * 1000,
		select: (results) =>
			results.map((item) => ({
				...item,
				label: item.fullName,
			})),
	});

	const searchResults = trimmedSearch.length >= 2 ? patientsSearchQuery.data ?? [] : [];
	const isSearching = patientsSearchQuery.isFetching;
	const searchError = patientsSearchQuery.error instanceof Error ? patientsSearchQuery.error.message : null;

	const handleSelectSearchResult = (patientId: number) => {
		Keyboard.dismiss();
		router.push({
			pathname: "/(professional)/patients/[id]",
			params: { id: String(patientId) },
		});
	};

	const handleShortcutPress = (id: string) => {
		switch (id) {
			case "appointments":
				router.push(appointmentsRoute as never);
				return;
			case "patients":
				router.push(patientsRoute as never);
				return;
			case "schedule":
				router.push(scheduleRoute as never);
				return;
			default:
				return;
		}
	};

	return (
		<Container>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<View>
						<Text style={styles.greeting}>{greeting}</Text>
						<Text style={styles.subtitle}>{greetingSubtitle}</Text>
					</View>
				</View>

				<View style={styles.searchContainer}>
					<Ionicons name="search" size={18} color="#8A94A6" style={styles.searchIcon} />
					<TextInput
						placeholder="Buscar paciente por nome ou CPF"
						placeholderTextColor="#9CA3AF"
						style={styles.searchInput}
						value={searchTerm}
						onChangeText={setSearchTerm}
						onFocus={() => setIsSearchFocused(true)}
						onBlur={() => setIsSearchFocused(false)}
						returnKeyType="search"
					/>
				</View>

				{trimmedSearch.length >= 2 ? (
					<View style={styles.searchResults}>
						{isSearching ? (
							<View style={styles.searchState}>
								<ActivityIndicator size="small" color="#2563EB" />
								<Text style={styles.searchStateText}>Buscando pacientes...</Text>
							</View>
						) : searchError ? (
							<View style={styles.searchState}>
								<Ionicons name="warning" size={16} color="#DC2626" />
								<Text style={[styles.searchStateText, { color: "#DC2626" }]}>{searchError}</Text>
							</View>
						) : searchResults.length === 0 ? (
							<View style={styles.searchState}>
								<Ionicons name="information-circle" size={16} color="#1D4ED8" />
								<Text style={styles.searchStateText}>Nenhum paciente encontrado.</Text>
							</View>
						) : (
							<View style={styles.searchList}>
								{searchResults.map((patient) => (
									<TouchableOpacity
										key={patient.id}
										style={styles.searchItem}
										onPress={() => handleSelectSearchResult(patient.id)}
									>
										<View style={styles.searchItemAvatar}>
											<Text style={styles.searchItemLetter}>{patient.fullName.slice(0, 1).toUpperCase()}</Text>
										</View>
										<View style={styles.searchItemContent}>
											<Text style={styles.searchItemName}>{patient.fullName}</Text>
											<Text style={styles.searchItemMeta}>CPF: {patient.cpf}</Text>
										</View>
										<Ionicons name="chevron-forward" size={18} color="#94A3B8" />
									</TouchableOpacity>
								))}
							</View>
						)}
					</View>
				) : null}

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Alertas dos pacientes</Text>
					{isAlertsLoading ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.statusList}
						>
							{Array.from({ length: 3 }).map((_, index) => (
								<View key={`alert-skeleton-${index}`} style={styles.statusCardSkeleton} />
							))}
						</ScrollView>
					) : alertsErrorMessage ? (
						<View style={styles.sectionMessage}>
							<Text style={styles.sectionMessageText}>{alertsErrorMessage}</Text>
						</View>
					) : alerts.length === 0 ? (
						<View style={styles.emptyState}>
							<Ionicons name="checkmark-circle" size={24} color="#16A34A" />
							<Text style={styles.emptyStateTitle}>Tudo calmo por aqui</Text>
							<Text style={styles.emptyStateSubtitle}>
								Nenhum alerta ativo para seus pacientes.
							</Text>
						</View>
					) : (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.statusList}
						>
							{alerts.map((alert) => {
								const accent = getSeverityAccent(alert.severity);
								const icon = getSeverityIcon(alert.severity);
								const backgroundColor = applyOpacity(accent, 0.12);
								const details = alert.details?.trim()
									? alert.details.trim()
									: "Sem detalhes adicionais.";

								return (
									<TouchableOpacity
										key={alert.id}
										activeOpacity={0.9}
										style={[styles.statusCard, { backgroundColor }]}
										onPress={() => openAlertModal(alert)}
									>
										<View style={[styles.statusIcon, { backgroundColor: accent }]}>
											<Ionicons name={icon} size={20} color="#FFFFFF" />
										</View>
										<Text style={styles.statusName}>{formatAlertKind(alert.kind)}</Text>
										<Text style={styles.statusPatient}>
											{alertPatientsQuery.data?.[alert.patientId] ?? `Paciente #${alert.patientId}`}
										</Text>
										<Text style={styles.statusDescription} numberOfLines={2}>{details}</Text>
										<View style={styles.statusMeta}>
											<Ionicons name="time" size={14} color="#475569" />
											<Text style={styles.statusMetaText}>{formatAlertTimestamp(alert.createdAt)}</Text>
										</View>
									</TouchableOpacity>
								);
							})}
						</ScrollView>
					)}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Seus atalhos</Text>
					<View style={styles.shortcutsList}>
						{SHORTCUTS.map((shortcut) => (
							<TouchableOpacity
								key={shortcut.id}
								activeOpacity={0.85}
								style={styles.shortcutCard}
								onPress={() => handleShortcutPress(shortcut.id)}
							>
								<View style={[styles.shortcutIcon, { backgroundColor: shortcut.accent }]}>
									<Ionicons name={shortcut.icon as never} size={22} color="#FFFFFF" />
								</View>
								<View style={styles.shortcutContent}>
									<Text style={styles.shortcutTitle}>{shortcut.title}</Text>
									<Text style={styles.shortcutDescription}>{shortcut.description}</Text>
								</View>
							</TouchableOpacity>
						))}
					</View>
				</View>
			</ScrollView>
			<Modal
				visible={isAlertModalVisible && Boolean(selectedAlert)}
				transparent
				animationType="fade"
				onRequestClose={closeAlertModal}
			>
				<View style={styles.alertModalOverlay}>
					<Pressable
						style={styles.alertModalBackdrop}
						onPress={closeAlertModal}
						disabled={isAcknowledgingAlert}
						accessibilityRole="button"
						accessibilityLabel="Fechar modal de alerta"
					/>
					<View style={styles.alertModalCard}>
						<View style={styles.alertModalHeader}>
							<View
								style={[styles.alertModalIcon, { backgroundColor: applyOpacity(selectedAlertAccent, 0.18) }]}
							>
								<Ionicons name={selectedAlertIcon} size={24} color={selectedAlertAccent} />
							</View>
							<View style={styles.alertModalHeaderText}>
								<Text style={styles.alertModalTitle}>
									{selectedAlert ? formatAlertKind(selectedAlert.kind) : "Alerta"}
								</Text>
								<Text style={styles.alertModalSubtitle}>
									{selectedAlertPatientName ?? (selectedAlert ? `Paciente #${selectedAlert.patientId}` : "")}
								</Text>
							</View>
						</View>
						<View style={styles.alertModalBody}>
							<View style={styles.alertModalRow}>
								<Text style={styles.alertModalLabel}>Severidade</Text>
								<Text style={[styles.alertModalValue, { color: selectedAlertAccent }]}>
									{selectedAlertSeverityLabel ?? "—"}
								</Text>
							</View>
							<View style={styles.alertModalRow}>
								<Text style={styles.alertModalLabel}>Criado em</Text>
								<Text style={styles.alertModalValue}>
									{selectedAlert ? formatAlertTimestamp(selectedAlert.createdAt) : "—"}
								</Text>
							</View>
							<Text style={styles.alertModalLabel}>Detalhes</Text>
							<Text style={styles.alertModalDetails}>{selectedAlertDetails}</Text>
							{acknowledgeError ? (
								<Text style={styles.alertModalError}>{acknowledgeError}</Text>
							) : null}
						</View>
						<View style={styles.alertModalActions}>
							<TouchableOpacity
								style={[
									styles.alertModalButton,
									isAcknowledgingAlert ? styles.alertModalButtonDisabled : null,
								]}
								activeOpacity={0.85}
								onPress={handleConfirmAlert}
								disabled={isAcknowledgingAlert}
							>
								<Text style={styles.alertModalButtonText}>
									{isAcknowledgingAlert ? "Confirmando..." : "Confirmar leitura"}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.alertModalSecondaryButton}
								activeOpacity={0.8}
								onPress={closeAlertModal}
								disabled={isAcknowledgingAlert}
							>
								<Text style={styles.alertModalSecondaryButtonText}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</Container>
	);
};

const styles = StyleSheet.create({
	scroll: {
		flex: 1,
		paddingHorizontal: 20,
	},
	scrollContent: {
		paddingBottom: 32,
		gap: 24,
	},
	header: {
		paddingTop: 12,
	},
	greeting: {
		fontSize: 26,
		fontWeight: "700",
		color: "#111827",
	},
	subtitle: {
		marginTop: 6,
		fontSize: 16,
		color: "#64748B",
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 16,
		backgroundColor: "#F1F5F9",
		paddingHorizontal: 16,
		height: 48,
	},
	searchIcon: {
		marginRight: 12,
	},
	searchInput: {
		flex: 1,
		fontSize: 15,
		color: "#0F172A",
	},
	searchResults: {
		marginTop: 12,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#DBEAFE",
		backgroundColor: "#FFFFFF",
		paddingVertical: 8,
		paddingHorizontal: 12,
		gap: 4,
	},
	searchState: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
	},
	searchStateText: {
		fontSize: 13,
		color: "#475569",
	},
	searchList: {
		gap: 4,
	},
	searchItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 10,
		paddingHorizontal: 4,
		borderRadius: 12,
	},
	searchItemAvatar: {
		width: 36,
		height: 36,
		borderRadius: 12,
		backgroundColor: "#D6E4FF",
		alignItems: "center",
		justifyContent: "center",
	},
	searchItemLetter: {
		fontSize: 16,
		fontWeight: "700",
		color: "#1D4ED8",
	},
	searchItemContent: {
		flex: 1,
		gap: 2,
	},
	searchItemName: {
		fontSize: 15,
		fontWeight: "600",
		color: "#0F172A",
	},
	searchItemMeta: {
		fontSize: 12,
		color: "#475569",
	},
	section: {
		gap: 16,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#0F172A",
	},
	statusList: {
		gap: 16,
	},
	statusCard: {
		width: 180,
		borderRadius: 20,
		padding: 16,
		gap: 10,
	},
	statusCardSkeleton: {
		width: 180,
		height: 160,
		borderRadius: 20,
		backgroundColor: "#E2E8F0",
	},
	statusIcon: {
		width: 44,
		height: 44,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	statusName: {
		fontSize: 16,
		fontWeight: "700",
		color: "#0F172A",
	},
	statusPatient: {
		fontSize: 13,
		fontWeight: "600",
		color: "#334155",
		marginTop: 2,
	},
	statusDescription: {
		fontSize: 13,
		color: "#475569",
	},
	statusMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 6,
	},
	statusMetaText: {
		fontSize: 12,
		color: "#475569",
	},
	shortcutsList: {
		gap: 12,
	},
	shortcutCard: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		padding: 16,
		backgroundColor: "#FFFFFF",
		gap: 16,
	},
	shortcutIcon: {
		width: 50,
		height: 50,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	shortcutContent: {
		flex: 1,
		gap: 4,
	},
	shortcutTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2937",
	},
	shortcutDescription: {
		fontSize: 13,
		color: "#64748B",
		lineHeight: 18,
	},
	sectionMessage: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#FECACA",
		backgroundColor: "#FEF2F2",
		paddingVertical: 20,
		paddingHorizontal: 16,
	},
	sectionMessageText: {
		fontSize: 13,
		color: "#B91C1C",
		textAlign: "center",
	},
	emptyState: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
		paddingVertical: 24,
		paddingHorizontal: 20,
		alignItems: "center",
		gap: 8,
	},
	emptyStateTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#166534",
	},
	emptyStateSubtitle: {
		fontSize: 13,
		color: "#475569",
		textAlign: "center",
	},
	alertModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(15, 23, 42, 0.45)",
		justifyContent: "center",
		paddingHorizontal: 24,
		paddingVertical: 32,
	},
	alertModalBackdrop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	alertModalCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		padding: 24,
		gap: 16,
		elevation: 12,
		shadowColor: "#0F172A",
		shadowOpacity: 0.12,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: 12 },
	},
	alertModalHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
	},
	alertModalIcon: {
		width: 52,
		height: 52,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	alertModalHeaderText: {
		flex: 1,
		gap: 4,
	},
	alertModalTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#0F172A",
	},
	alertModalSubtitle: {
		fontSize: 14,
		color: "#475569",
	},
	alertModalBody: {
		gap: 12,
	},
	alertModalRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	alertModalLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: "#64748B",
	},
	alertModalValue: {
		fontSize: 15,
		fontWeight: "600",
		color: "#0F172A",
	},
	alertModalDetails: {
		fontSize: 14,
		color: "#0F172A",
		lineHeight: 20,
	},
	alertModalError: {
		fontSize: 13,
		color: "#B91C1C",
	},
	alertModalActions: {
		gap: 12,
	},
	alertModalButton: {
		borderRadius: 16,
		backgroundColor: "#1D4ED8",
		alignItems: "center",
		paddingVertical: 14,
	},
	alertModalButtonDisabled: {
		opacity: 0.7,
	},
	alertModalButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	alertModalSecondaryButton: {
		alignItems: "center",
		paddingVertical: 10,
	},
	alertModalSecondaryButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1D4ED8",
	},
});

export default ProfessionalHomeScreen;

function getSeverityAccent(severity: AlertSeverity) {
	switch (severity) {
		case "high":
			return "#EF4444";
		case "medium":
			return "#F59E0B";
		case "low":
		default:
			return "#2563EB";
	}
}

function getSeverityIcon(severity: AlertSeverity): IoniconName {
	switch (severity) {
		case "high":
			return "warning";
		case "medium":
			return "alert-circle";
		case "low":
		default:
			return "information-circle";
	}
}

function applyOpacity(hexColor: string, opacity: number) {
	const normalized = hexColor.replace("#", "");
	if (normalized.length !== 6) {
		return hexColor;
	}
	const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
		.toString(16)
		.padStart(2, "0");
	return `#${normalized}${alpha}`;
}

function formatAlertTimestamp(iso: Alert["createdAt"]) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "Data indisponível";
	}
	return date.toLocaleString("pt-BR", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatAlertSeverity(severity: AlertSeverity) {
	switch (severity) {
		case "high":
			return "Alta";
		case "medium":
			return "Média";
		case "low":
		default:
			return "Baixa";
	}
}

function formatAlertKind(kind: string) {
	const cleaned = kind.trim();
	if (!cleaned) {
		return "Alerta";
	}
	return cleaned
		.replace(/[-_]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}
