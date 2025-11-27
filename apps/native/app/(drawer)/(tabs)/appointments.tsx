import { useState, useMemo } from "react";
import { Container } from "@/components/container";
import { ProfessionalAvatar } from "@/components/professional-avatar";
import {
	ApiError,
	confirmPatientAppointment,
	declinePatientAppointment,
	fetchPatientAppointments,
	type PatientAppointment,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ActivityIndicator,
	Alert,
	Modal,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useRouter } from "expo-router";

const STATUS_LABELS = {
	scheduled: "Agendada",
	confirmed: "Confirmada",
	completed: "Concluída",
	no_show: "Faltou",
	canceled: "Cancelada",
} as const;

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
	return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

export default function PatientAppointmentsTab() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [selectedAppointment, setSelectedAppointment] = useState<PatientAppointment | null>(null);

	const {
		data,
		error,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["patient", "appointments"],
		queryFn: () => fetchPatientAppointments({ limit: 50 }),
		staleTime: 30 * 1000,
	});

	const appointments = data ?? [];
	const isRefreshing = isFetching && !isLoading;
	const errorMessage = useMemo(() => {
		if (!error) {
			return null;
		}
		if (error instanceof ApiError) {
			return error.response?.message ?? "Não foi possível carregar suas consultas.";
		}
		if (error instanceof Error) {
			return error.message;
		}
		return "Não foi possível carregar suas consultas.";
	}, [error]);

	const confirmMutation = useMutation({
		mutationFn: (appointmentId: number) => confirmPatientAppointment(appointmentId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["patient", "home"] });
			await queryClient.invalidateQueries({ queryKey: ["patient", "appointments"] });
		},
	});

	const declineMutation = useMutation({
		mutationFn: (appointmentId: number) => declinePatientAppointment(appointmentId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["patient", "home"] });
			await queryClient.invalidateQueries({ queryKey: ["patient", "appointments"] });
		},
	});

	const closeModal = () => setSelectedAppointment(null);

	const handleConfirm = async () => {
		if (!selectedAppointment) return;
		try {
			await confirmMutation.mutateAsync(selectedAppointment.id);
			Alert.alert("Presença confirmada", "Sua presença foi confirmada com sucesso.");
			closeModal();
		} catch (mutationError) {
			const message =
				mutationError instanceof ApiError
					? mutationError.response?.message ?? "Não foi possível confirmar sua presença."
					: "Não foi possível confirmar sua presença.";
			Alert.alert("Erro", message);
		}
	};

	const handleDecline = async () => {
		if (!selectedAppointment) return;
		try {
			await declineMutation.mutateAsync(selectedAppointment.id);
			Alert.alert("Presença atualizada", "Registramos que você não poderá comparecer.");
			closeModal();
		} catch (mutationError) {
			const message =
				mutationError instanceof ApiError
					? mutationError.response?.message ?? "Não foi possível atualizar sua presença."
					: "Não foi possível atualizar sua presença.";
			Alert.alert("Erro", message);
		}
	};

	const renderContent = () => {
		if (isLoading) {
			return (
				<View style={styles.feedbackCard}>
					<ActivityIndicator color="#2F66F5" />
					<Text style={styles.feedbackText}>Carregando suas consultas...</Text>
				</View>
			);
		}
		if (errorMessage) {
			return (
				<View style={styles.feedbackCard}>
					<Text style={[styles.feedbackText, { color: "#B91C1C" }]}>{errorMessage}</Text>
					<TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => refetch()}>
						<Text style={styles.retryButtonText}>Tentar novamente</Text>
					</TouchableOpacity>
				</View>
			);
		}
		if (appointments.length === 0) {
			return (
				<View style={styles.feedbackCard}>
					<Ionicons name="calendar-outline" size={28} color="#2563EB" style={{ marginBottom: 12 }} />
					<Text style={styles.feedbackText}>Você não possui consultas marcadas.</Text>
				</View>
			);
		}
		return appointments.map((appointment) => {
			const professional = appointment.professional;
			const statusLabel = STATUS_LABELS[appointment.status] ?? appointment.status;
			return (
				<TouchableOpacity
					key={appointment.id}
					style={styles.card}
					activeOpacity={0.85}
					onPress={() => setSelectedAppointment(appointment)}
				>
					<ProfessionalAvatar
						uri={professional?.avatarUrl ?? null}
						size={56}
						backgroundColor="#E0EAFF"
						iconColor="#1D4ED8"
					/>
					<View style={{ flex: 1, marginLeft: 16 }}>
						<Text style={styles.cardDoctor}>{professional?.name ?? "Profissional a definir"}</Text>
						{professional?.specialty ? (
							<Text style={styles.cardSpecialty}>{professional.specialty}</Text>
						) : null}
						<View style={styles.cardInfoRow}>
							<Ionicons name="calendar" size={14} color="#6B7280" style={{ marginRight: 6 }} />
							<Text style={styles.cardDate}>{formatDateTime(appointment.startsAt)}</Text>
						</View>
					</View>
					<View style={styles.statusBadge}>
						<Text style={styles.statusText}>{statusLabel}</Text>
					</View>
				</TouchableOpacity>
			);
		});
	};

	const isModalLoading = confirmMutation.isPending || declineMutation.isPending;

	return (
		<Container>
			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={() => refetch()}
						colors={["#2F66F5"]}
						tintColor="#2F66F5"
					/>
				}
			>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						activeOpacity={0.8}
						onPress={() => router.back()}
					>
						<Ionicons name="arrow-back" size={20} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Suas consultas</Text>
				</View>

				<Text style={styles.sectionTitle}>Consultas marcadas</Text>

				{renderContent()}
			</ScrollView>

			<Modal transparent visible={selectedAppointment !== null} animationType="fade">
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Consulta marcada</Text>
						<Text style={styles.modalDescription}>
							Confirme sua presença para que possamos manter seu atendimento como programado.
						</Text>
						<TouchableOpacity
							style={[styles.primaryButton, isModalLoading ? { opacity: 0.7 } : null]}
							activeOpacity={0.9}
							onPress={handleConfirm}
							disabled={isModalLoading}
						>
							{isModalLoading ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text style={styles.primaryButtonText}>Confirmar presença</Text>
							)}
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.secondaryButton, isModalLoading ? { opacity: 0.7 } : null]}
							activeOpacity={0.9}
							onPress={handleDecline}
							disabled={isModalLoading}
						>
							<Text style={styles.secondaryButtonText}>Não poderei ir</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.modalClose}
							activeOpacity={0.8}
							onPress={closeModal}
							disabled={isModalLoading}
						>
							<Text style={styles.modalCloseText}>Fechar</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</Container>
	);
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingHorizontal: 24,
	},
	scrollContent: {
		paddingVertical: 32,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingBottom: 24,
	},
	backButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#D1D5DB",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: "#1F2933",
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2933",
		marginBottom: 16,
	},
	card: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#D6E0FF",
		marginBottom: 12,
		backgroundColor: "#FFFFFF",
	},
	cardDoctor: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2933",
	},
	cardSpecialty: {
		marginTop: 2,
		fontSize: 13,
		color: "#6B7280",
	},
	cardInfoRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 12,
	},
	cardDate: {
		fontSize: 13,
		color: "#6B7280",
	},
	statusBadge: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 999,
		backgroundColor: "#EEF2FF",
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#1D4ED8",
	},
	feedbackCard: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
		paddingVertical: 28,
		paddingHorizontal: 20,
		alignItems: "center",
		marginBottom: 16,
	},
	feedbackText: {
		fontSize: 14,
		color: "#4B5563",
		textAlign: "center",
		lineHeight: 20,
	},
	retryButton: {
		marginTop: 16,
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 20,
		backgroundColor: "#2F66F5",
	},
	retryButtonText: {
		color: "#FFFFFF",
		fontWeight: "600",
		fontSize: 14,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(15, 23, 42, 0.35)",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 32,
	},
	modalCard: {
		width: "100%",
		borderRadius: 24,
		backgroundColor: "#FFFFFF",
		paddingVertical: 32,
		paddingHorizontal: 24,
		alignItems: "center",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#111827",
		marginBottom: 12,
	},
	modalDescription: {
		fontSize: 13,
		color: "#6B7280",
		textAlign: "center",
		marginBottom: 24,
		lineHeight: 20,
	},
	primaryButton: {
		width: "100%",
		backgroundColor: "#2F66F5",
		borderRadius: 16,
		paddingVertical: 14,
		alignItems: "center",
		marginBottom: 12,
	},
	primaryButtonText: {
		color: "#FFFFFF",
		fontWeight: "600",
		fontSize: 15,
	},
	secondaryButton: {
		width: "100%",
		borderRadius: 16,
		paddingVertical: 14,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#D1D5DB",
	},
	secondaryButtonText: {
		color: "#1F2933",
		fontWeight: "500",
		fontSize: 15,
	},
	modalClose: {
		marginTop: 16,
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: "#E2E8F0",
	},
	modalCloseText: {
		fontSize: 14,
		color: "#4B5563",
		fontWeight: "500",
	},
});
