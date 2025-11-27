import { Container } from "@/components/container";
import { ProfessionalAvatar } from "@/components/professional-avatar";
import {
	ApiError,
	fetchPatientHome,
	type AppointmentStatus,
	type AppointmentType,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, type ComponentProps } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Shortcut = {
	id: string;
	icon: IoniconName;
	title: string;
	description: string;
	background: string;
	color: string;
	route?: Href;
};

const SHORTCUTS: Shortcut[] = [
	{
		id: "appointments",
		icon: "calendar",
		title: "Suas consultas",
		description: "Acompanhe seus agendamentos e veja o que vem por aí.",
		background: "#2563EB",
		color: "#FFFFFF",
		route: "/(drawer)/(tabs)/appointments",
	},
	{
		id: "symptom",
		icon: "chatbubbles",
		title: "Relatar sintoma",
		description: "Comunique seus sintomas de forma rápida e prática.",
		background: "#2563EB",
		color: "#FFFFFF",
		route: "/(drawer)/report-symptom",
	},
	{
		id: "help",
		icon: "book",
		title: "Como funciona o app",
		description: "Aprenda a usar o app com uma explicação rápida e fácil.",
		background: "#2563EB",
		color: "#FFFFFF",
		route: "/(drawer)/(tabs)/profile",
	},
];

const STATUS_LABELS: Record<AppointmentStatus, string> = {
	scheduled: "Agendada",
	confirmed: "Confirmada",
	completed: "Concluída",
	no_show: "Faltou",
	canceled: "Cancelada",
};

const STATUS_BADGE_STYLES: Record<AppointmentStatus, { bg: string; text: string }> = {
	scheduled: { bg: "#E0F2FE", text: "#0369A1" },
	confirmed: { bg: "#DCFCE7", text: "#166534" },
	completed: { bg: "#F5F3FF", text: "#4C1D95" },
	no_show: { bg: "#FEE2E2", text: "#B91C1C" },
	canceled: { bg: "#E2E8F0", text: "#1F2937" },
};

const TYPE_LABELS: Record<AppointmentType, string> = {
	triage: "Triagem",
	treatment: "Tratamento",
	return: "Retorno",
};

const TYPE_ACCENTS: Record<AppointmentType, string> = {
	triage: "#2563EB",
	treatment: "#0EA5E9",
	return: "#7C3AED",
};

function formatDateTime(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
	const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
	});

	const datePart = dateFormatter.format(date);
	const timePart = timeFormatter.format(date);
	return `${datePart} às ${timePart}`;
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

function getFirstName(fullName?: string | null) {
	if (!fullName) return null;
	const trimmed = fullName.trim();
	if (!trimmed) return null;
	return trimmed.split(" ")[0] ?? trimmed;
}

export default function PatientHome() {
	const router = useRouter();
	const {
		data,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useQuery({
		queryKey: ["patient", "home"],
		queryFn: fetchPatientHome,
		staleTime: 30 * 1000,
	});

	useEffect(() => {
		if (error instanceof ApiError && error.status === 401) {
			router.replace("/(drawer)/patient-login");
		}
	}, [error, router]);

	const patient = data?.patient;
	const nextAppointments = data?.nextAppointments ?? [];
	const primaryAppointment = nextAppointments[0] ?? null;
	const audioMaterials = data?.audioMaterials ?? [];
	const firstName = useMemo(() => getFirstName(patient?.fullName), [patient?.fullName]);
	const greeting = isLoading
		? "Olá 👋"
		: `Olá, ${firstName ?? patient?.fullName ?? "paciente"} 👋`;
	const greetingSubtitle = isLoading
		? "Carregando suas informações..."
		: "Como você está hoje?";
	const isRefreshing = isFetching && !isLoading;

	const errorMessage = useMemo(() => {
		if (!error) {
			return null;
		}
		if (error instanceof ApiError) {
			if (error.status === 401) {
				return null;
			}
			return error.response?.message ?? "Não foi possível carregar seus dados.";
		}
		if (error instanceof Error) {
			return error.message;
		}
		return "Não foi possível carregar seus dados.";
	}, [error]);

	const handleRefresh = useCallback(() => {
		refetch();
	}, [refetch]);

	const handleRetry = useCallback(() => {
		refetch();
	}, [refetch]);

	const handleOpenMaterial = useCallback(async (url: string) => {
		try {
			const canOpen = await Linking.canOpenURL(url);
			if (canOpen) {
				await Linking.openURL(url);
			} else {
				Alert.alert(
					"Não foi possível abrir o conteúdo",
					"Verifique o endereço informado e tente novamente.",
				);
			}
		} catch {
			Alert.alert(
				"Não foi possível abrir o conteúdo",
				"Tente novamente mais tarde.",
			);
		}
	}, []);

	const handleShortcutPress = useCallback(
		(route?: Href) => {
			if (route) {
				router.push(route);
			}
		},
		[router],
	);

	const primaryAppointmentSection = useMemo(() => {
		if (!primaryAppointment) {
			return (
				<View style={styles.appointmentEmptyState}>
					<Ionicons name="calendar-outline" size={28} color="#2563EB" />
					<Text style={styles.appointmentEmptyText}>Nenhuma consulta agendada</Text>
					<Text style={styles.appointmentEmptySubtitle}>
						Assim que uma nova consulta for marcada, você verá os detalhes aqui.
					</Text>
				</View>
			);
		}

		const typeLabel = TYPE_LABELS[primaryAppointment.type] ?? "Consulta";
		const accent = TYPE_ACCENTS[primaryAppointment.type] ?? "#2563EB";
		const statusMeta = STATUS_BADGE_STYLES[primaryAppointment.status] ?? {
			bg: "#E2E8F0",
			text: "#1F2937",
		};
		const statusLabel = STATUS_LABELS[primaryAppointment.status] ?? primaryAppointment.status;
		const note = primaryAppointment.notes?.trim();
		const professional = primaryAppointment.professional;
		const avatarBackground = applyOpacity(accent, 0.18);

		return (
			<View style={styles.appointmentCard}>
				<View style={styles.appointmentInfo}>
					<View style={styles.appointmentProfessionalRow}>
						<ProfessionalAvatar
							uri={professional?.avatarUrl ?? null}
							size={48}
							backgroundColor={avatarBackground}
							iconColor="#FFFFFF"
						/>
						<View style={styles.appointmentProfessionalIdentity}>
							<Text style={styles.appointmentProfessionalName}>
								{professional?.name ?? "Profissional a definir"}
							</Text>
							{professional?.specialty ? (
								<Text style={styles.appointmentProfessionalSpecialty}>{professional.specialty}</Text>
							) : null}
						</View>
					</View>
					<Text style={styles.appointmentLabel}>Próxima consulta</Text>
					<Text style={styles.appointmentDate}>{formatDateTime(primaryAppointment.startsAt)}</Text>
					<View style={styles.appointmentMetaGroup}>
						<View style={styles.appointmentMetaRow}>
							<Ionicons name="medkit" size={16} color="#E0EAFF" style={styles.appointmentMetaIcon} />
							<Text style={styles.appointmentMetaText}>{typeLabel}</Text>
						</View>
						<View
							style={[styles.appointmentStatusBadge, { backgroundColor: statusMeta.bg }]}
						>
							<Text style={[styles.appointmentStatusText, { color: statusMeta.text }]}>
								{statusLabel}
							</Text>
						</View>
					</View>
					{note ? <Text style={styles.appointmentNote}>{note}</Text> : null}
				</View>
				<View
					style={[
						styles.appointmentIconWrapper,
						{ backgroundColor: applyOpacity(accent, 0.15) },
					]}
				>
					<Ionicons name="calendar" size={32} color="#FFFFFF" />
				</View>
			</View>
		);
	}, [primaryAppointment]);


	const audioSection = useMemo(() => {
		if (audioMaterials.length === 0) {
			return (
				<View style={styles.emptyState}>
					<Ionicons name="musical-notes-outline" size={24} color="#2563EB" />
					<Text style={styles.emptyStateTitle}>Nenhum conteúdo disponível</Text>
					<Text style={styles.emptyStateSubtitle}>
						Quando houver materiais recomendados para você, eles aparecerão aqui.
					</Text>
				</View>
			);
		}

		return audioMaterials.map((material) => (
			<TouchableOpacity
				key={material.url}
				style={styles.audioCard}
				activeOpacity={0.85}
				onPress={() => handleOpenMaterial(material.url)}
			>
				<View style={styles.audioIconWrapper}>
					<Ionicons name="play" size={18} color="#1D4ED8" />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={styles.audioTitle}>{material.title}</Text>
					<Text style={styles.audioSubtitle}>Toque para abrir o conteúdo</Text>
				</View>
				<Ionicons name="chevron-forward" size={18} color="#94A3B8" />
			</TouchableOpacity>
		));
	}, [audioMaterials, handleOpenMaterial]);

	const mainContent = useMemo(() => {
		if (isLoading) {
			return (
				<View style={styles.loadingState}>
					<ActivityIndicator color="#2F66F5" />
					<Text style={styles.loadingText}>Carregando suas informações...</Text>
				</View>
			);
		}
		if (errorMessage) {
			return (
				<View style={styles.errorCard}>
					<Text style={styles.errorText}>{errorMessage}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.85}>
						<Text style={styles.retryButtonText}>Tentar novamente</Text>
					</TouchableOpacity>
				</View>
			);
		}
		return (
			<>
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Suas próximas consultas</Text>
					{primaryAppointmentSection}
				</View>
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Conteúdos para você</Text>
					{audioSection}
				</View>
			</>
		);
	}, [
		isLoading,
		errorMessage,
		handleRetry,
		primaryAppointmentSection,
		audioSection,
	]);

	return (
		<Container>
			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						colors={["#2F66F5"]}
						tintColor="#2F66F5"
					/>
				}
			>
				<View style={styles.header}>
					<Text style={styles.greeting}>{greeting}</Text>
					<Text style={styles.greetingSubtitle}>{greetingSubtitle}</Text>
				</View>

				{mainContent}

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Seus atalhos</Text>
					{SHORTCUTS.map((item, index) => (
						<TouchableOpacity
							key={item.id}
							style={[
								styles.shortcutCard,
								index === SHORTCUTS.length - 1 ? { marginBottom: 0 } : null,
							]}
							activeOpacity={item.route ? 0.85 : 1}
							onPress={() => handleShortcutPress(item.route)}
						>
							<View style={[styles.shortcutIcon, { backgroundColor: item.background }]}>
								<Ionicons name={item.icon} size={24} color={item.color} />
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.shortcutTitle}>{item.title}</Text>
								<Text style={styles.shortcutDescription}>{item.description}</Text>
							</View>
						</TouchableOpacity>
					))}
				</View>
			</ScrollView>
		</Container>
	);
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingHorizontal: 24,
	},
	scrollContent: {
		paddingBottom: 32,
	},
	header: {
		paddingTop: 16,
		paddingBottom: 24,
	},
	greeting: {
		fontSize: 26,
		fontWeight: "700",
		color: "#1F2933",
	},
	greetingSubtitle: {
		marginTop: 6,
		fontSize: 16,
		color: "#6B7280",
	},
	section: {
		marginBottom: 28,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#1F2933",
		marginBottom: 16,
	},
	appointmentCard: {
		backgroundColor: "#2F66F5",
		borderRadius: 24,
		padding: 20,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	appointmentInfo: {
		flex: 1,
		paddingRight: 16,
	},
	appointmentProfessionalRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 16,
	},
	appointmentProfessionalIdentity: {
		marginLeft: 14,
		flex: 1,
	},
	appointmentProfessionalName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	appointmentProfessionalSpecialty: {
		marginTop: 4,
		fontSize: 13,
		color: "#E0EAFF",
	},
	appointmentLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: "#BFDBFE",
		letterSpacing: 0.4,
		textTransform: "uppercase",
	},
	appointmentDate: {
		marginTop: 6,
		fontSize: 20,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	appointmentMetaGroup: {
		marginTop: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	appointmentMetaRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	appointmentMetaIcon: {
		marginRight: 8,
	},
	appointmentMetaText: {
		fontSize: 14,
		color: "#E0EAFF",
		fontWeight: "500",
	},
	appointmentStatusBadge: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 999,
	},
	appointmentStatusText: {
		fontSize: 13,
		fontWeight: "600",
	},
	appointmentNote: {
		marginTop: 12,
		fontSize: 13,
		color: "#E0EAFF",
		lineHeight: 18,
	},
	appointmentIconWrapper: {
		width: 64,
		height: 64,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	appointmentEmptyState: {
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "#D6E0FF",
		backgroundColor: "#FFFFFF",
		paddingVertical: 24,
		paddingHorizontal: 24,
		alignItems: "center",
	},
	appointmentEmptyText: {
		marginTop: 12,
		fontSize: 15,
		fontWeight: "600",
		color: "#1F2933",
		textAlign: "center",
	},
	appointmentEmptySubtitle: {
		marginTop: 6,
		fontSize: 13,
		color: "#6B7280",
		textAlign: "center",
		lineHeight: 18,
	},
	otherAppointments: {
		marginTop: 16,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		backgroundColor: "#FFFFFF",
	},
	otherAppointmentsTitle: {
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 8,
		fontSize: 15,
		fontWeight: "600",
		color: "#1F2933",
	},
	otherAppointmentsDivider: {
		height: 1,
		backgroundColor: "#F1F5F9",
		marginHorizontal: 16,
	},
	otherAppointmentItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		flexDirection: "row",
		alignItems: "center",
	},
	otherAppointmentInfo: {
		flex: 1,
	},
	otherAppointmentProfessional: {
		fontSize: 15,
		fontWeight: "600",
		color: "#1F2933",
	},
	otherAppointmentSpecialty: {
		marginTop: 4,
		fontSize: 13,
		color: "#475569",
	},
	otherAppointmentTimeRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
	},
	otherAppointmentTimeIcon: {
		marginRight: 6,
	},
	otherAppointmentTime: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1F2933",
	},
	otherAppointmentMeta: {
		marginTop: 2,
		fontSize: 13,
		color: "#6B7280",
	},
	otherStatusBadge: {
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: 999,
	},
	otherStatusText: {
		fontSize: 12,
		fontWeight: "600",
	},
	audioCard: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		backgroundColor: "#FFFFFF",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		marginBottom: 12,
	},
	audioIconWrapper: {
		width: 44,
		height: 44,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#EEF2FF",
		marginRight: 16,
	},
	audioTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#1F2933",
	},
	audioSubtitle: {
		marginTop: 4,
		fontSize: 13,
		color: "#6B7280",
	},
	emptyState: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		backgroundColor: "#F9FAFB",
		padding: 20,
		alignItems: "center",
	},
	emptyStateTitle: {
		marginTop: 12,
		fontSize: 15,
		fontWeight: "600",
		color: "#1F2933",
	},
	emptyStateSubtitle: {
		marginTop: 6,
		fontSize: 13,
		color: "#6B7280",
		textAlign: "center",
		lineHeight: 18,
	},
	errorCard: {
		borderRadius: 18,
		padding: 16,
		backgroundColor: "#FEE2E2",
		borderWidth: 1,
		borderColor: "#FCA5A5",
		marginBottom: 24,
		alignItems: "center",
	},
	errorText: {
		color: "#B91C1C",
		fontSize: 14,
		lineHeight: 20,
		textAlign: "center",
		marginBottom: 12,
	},
	retryButton: {
		borderRadius: 999,
		paddingHorizontal: 18,
		paddingVertical: 8,
		backgroundColor: "#B91C1C",
	},
	retryButtonText: {
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "600",
	},
	loadingState: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		backgroundColor: "#FFFFFF",
		paddingVertical: 32,
		paddingHorizontal: 20,
		alignItems: "center",
		marginBottom: 24,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 14,
		color: "#6B7280",
	},
	shortcutCard: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#D6E0FF",
		padding: 18,
		marginBottom: 14,
		backgroundColor: "#FFFFFF",
	},
	shortcutIcon: {
		width: 56,
		height: 56,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	shortcutTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2933",
		marginBottom: 4,
	},
	shortcutDescription: {
		fontSize: 13,
		color: "#6B7280",
	},
});
