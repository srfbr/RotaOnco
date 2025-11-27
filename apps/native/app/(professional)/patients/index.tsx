import { Container } from "@/components/container";
import { fetchPatients, PatientStage, PatientStatus } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";

const STATUS_LABELS: Record<PatientStatus, string> = {
	active: "Ativo",
	inactive: "Inativo",
	at_risk: "Em risco",
};

const STAGE_LABELS: Record<PatientStage, string> = {
	pre_triage: "Pré-triagem",
	in_treatment: "Em tratamento",
	post_treatment: "Pós-tratamento",
};

const STATUS_BADGE_STYLES: Record<PatientStatus, { bg: string; text: string }> = {
	active: { bg: "#DCFCE7", text: "#166534" },
	inactive: { bg: "#E2E8F0", text: "#1F2937" },
	at_risk: { bg: "#FEF3C7", text: "#92400E" },
};

const STAGE_BADGE_STYLES: Record<PatientStage, { bg: string; text: string }> = {
	pre_triage: { bg: "#DBEAFE", text: "#1D4ED8" },
	in_treatment: { bg: "#E0F2FE", text: "#0369A1" },
	post_treatment: { bg: "#E9D5FF", text: "#6B21A8" },
};

const STAGE_ACCENTS: Record<PatientStage, string> = {
	pre_triage: "#1D4ED8",
	in_treatment: "#0EA5E9",
	post_treatment: "#7C3AED",
};

function formatCpf(cpf: string) {
	const digits = cpf.replace(/\D/g, "");
	if (digits.length !== 11) {
		return cpf;
	}
	return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function getInitial(name: string) {
	const trimmed = name.trim();
	if (!trimmed) return "?";
	return trimmed[0].toUpperCase();
}

const ProfessionalPatientsScreen = () => {
	const router = useRouter();
	const [refreshing, setRefreshing] = useState(false);

	const {
		data,
		isLoading,
		isError,
		refetch,
		error,
	} = useQuery({
		queryKey: ["professional", "patients"],
		queryFn: () => fetchPatients({ limit: 50 }),
		staleTime: 1000 * 30,
	});

	const patients = useMemo(() => data?.data ?? [], [data]);

	const handleRefresh = useCallback(() => {
		setRefreshing(true);
		refetch().finally(() => {
			setRefreshing(false);
		});
	}, [refetch]);

	const errorMessage = useMemo(() => {
		if (error instanceof Error) {
			return error.message;
		}
		return "Não foi possível carregar os pacientes.";
	}, [error]);

	const handleSelectPatient = useCallback(
		(patientId: number) => {
			router.push({
				pathname: "/(professional)/patients/[id]",
				params: { id: String(patientId) },
			});
		},
		[router],
	);

	return (
		<Container>
			<View style={styles.screen}>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						activeOpacity={0.8}
						onPress={() => router.replace("/(professional)/(tabs)/workspace")}
					>
						<Ionicons name="arrow-back" size={22} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Meus pacientes</Text>
				</View>

				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={handleRefresh}
							colors={["#2563EB"]}
							progressBackgroundColor="#FFFFFF"
						/>
					}
				>
					<Text style={styles.subtitle}>Seus pacientes atuais</Text>

					{isLoading && !refreshing ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="small" color="#2563EB" />
							<Text style={styles.loadingText}>Carregando pacientes...</Text>
						</View>
					) : null}

					{isError ? (
						<View style={styles.errorState}>
							<Ionicons name="warning" size={20} color="#B91C1C" />
							<Text style={styles.errorText}>{errorMessage}</Text>
							<TouchableOpacity
								style={styles.retryButton}
								activeOpacity={0.85}
								onPress={() => refetch()}
							>
								<Text style={styles.retryButtonText}>Tentar novamente</Text>
							</TouchableOpacity>
						</View>
					) : null}

					{!isLoading && !isError && patients.length === 0 ? (
						<View style={styles.emptyState}>
							<Ionicons name="people-outline" size={28} color="#2563EB" />
							<Text style={styles.emptyTitle}>Nenhum paciente encontrado</Text>
							<Text style={styles.emptyText}>
								Cadastre um novo paciente ou ajuste os filtros para visualizar a lista.
							</Text>
						</View>
					) : null}

					<View style={styles.list}>
						{patients.map((patient) => {
							const stageAccent = STAGE_ACCENTS[patient.stage];
							const statusStyle = STATUS_BADGE_STYLES[patient.status];
							const stageStyle = STAGE_BADGE_STYLES[patient.stage];

							return (
								<TouchableOpacity
									key={patient.id}
									style={styles.card}
									activeOpacity={0.85}
									onPress={() => handleSelectPatient(patient.id)}
								>
									<View style={[styles.avatar, { backgroundColor: stageAccent }]}>
										<Text style={styles.avatarLetter}>{getInitial(patient.fullName)}</Text>
									</View>
									<View style={styles.cardBody}>
										<Text style={styles.patientName}>{patient.fullName}</Text>
										<Text style={styles.cpf}>CPF: {formatCpf(patient.cpf)}</Text>
										<View style={styles.badgeRow}>
											<View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
												<Text style={[styles.badgeText, { color: statusStyle.text }]}>
													{STATUS_LABELS[patient.status]}
												</Text>
											</View>
											<View style={[styles.badge, { backgroundColor: stageStyle.bg }]}>
												<Text style={[styles.badgeText, { color: stageStyle.text }]}>
													{STAGE_LABELS[patient.stage]}
												</Text>
											</View>
										</View>
									</View>
									<Ionicons name="chevron-forward" size={20} color="#94A3B8" />
								</TouchableOpacity>
							);
						})}
					</View>
				</ScrollView>
			</View>
		</Container>
	);
};

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 12,
		backgroundColor: "#FFFFFF",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
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
	},
	scroll: {
		flex: 1,
		marginTop: 24,
	},
	content: {
		paddingBottom: 48,
		gap: 16,
	},
	subtitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#111827",
	},
	list: {
		gap: 12,
	},
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		padding: 16,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
		shadowColor: "#0F172A",
		shadowOpacity: 0.04,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	avatar: {
		width: 56,
		height: 56,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarLetter: {
		fontSize: 20,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	cardBody: {
		flex: 1,
		gap: 6,
	},
	patientName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#111827",
	},
	cpf: {
		fontSize: 13,
		color: "#475569",
	},
	badgeRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 4,
	},
	badge: {
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: "600",
	},
	loadingContainer: {
		marginTop: 24,
		alignItems: "center",
		gap: 12,
	},
	loadingText: {
		fontSize: 13,
		color: "#475569",
	},
	emptyState: {
		marginTop: 32,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#BFDBFE",
		backgroundColor: "#F8FBFF",
		padding: 24,
		alignItems: "center",
		gap: 12,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2937",
	},
	emptyText: {
		fontSize: 14,
		color: "#475569",
		textAlign: "center",
		lineHeight: 20,
	},
	errorState: {
		marginTop: 24,
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
});

export default ProfessionalPatientsScreen;
