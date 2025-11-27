import { Container } from "@/components/container";
import type { ProfessionalPatientDetail } from "@/lib/api";
import {
	fetchProfessionalPatientDetail,
	PatientStage,
	PatientStatus,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ActivityIndicator,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useCallback, useMemo } from "react";

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

const STATUS_BADGE_COLORS: Record<PatientStatus, { bg: string; text: string }> = {
	active: { bg: "#DCFCE7", text: "#166534" },
	inactive: { bg: "#E2E8F0", text: "#1F2937" },
	at_risk: { bg: "#FEF3C7", text: "#92400E" },
};

const STAGE_BADGE_COLORS: Record<PatientStage, { bg: string; text: string }> = {
	pre_triage: { bg: "#DBEAFE", text: "#1D4ED8" },
	in_treatment: { bg: "#E0F2FE", text: "#0369A1" },
	post_treatment: { bg: "#E9D5FF", text: "#6B21A8" },
};

function formatCpf(value: string) {
	const digits = value.replace(/\D/g, "");
	if (digits.length !== 11) {
		return value;
	}
	return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDate(value: string | null) {
	if (!value) {
		return "-";
	}
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return "-";
		}
		return new Intl.DateTimeFormat("pt-BR", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(date);
	} catch (error) {
		return "-";
	}
}

const ProfessionalPatientDetailScreen = () => {
	const router = useRouter();
	const params = useLocalSearchParams<{ id?: string }>();
	const patientId = useMemo(() => {
		const raw = params.id;
		if (!raw) {
			return NaN;
		}
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : NaN;
	}, [params.id]);

	const query = useQuery<ProfessionalPatientDetail | null>({
		queryKey: ["professional", "patient", patientId],
		queryFn: () => fetchProfessionalPatientDetail(patientId),
		enabled: Number.isFinite(patientId),
		staleTime: 60 * 1000,
	});

	const handleGoBack = useCallback(() => {
		router.back();
	}, [router]);

	const detail = query.data;
	const notFound = !query.isLoading && detail === null;
	const invalidId = Number.isNaN(patientId);

	return (
		<Container>
			<View style={styles.screen}>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						activeOpacity={0.8}
						onPress={handleGoBack}
					>
						<Ionicons name="arrow-back" size={22} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Detalhes do paciente</Text>
				</View>

				{invalidId ? (
					<View style={styles.centerContent}>
						<Ionicons name="alert-circle" size={28} color="#DC2626" />
						<Text style={styles.centerTitle}>Identificador inválido</Text>
						<Text style={styles.centerSubtitle}>
							Não foi possível abrir este paciente. Volte e tente novamente.
						</Text>
					</View>
				) : query.isLoading ? (
					<View style={styles.centerContent}>
						<ActivityIndicator size="small" color="#2563EB" />
						<Text style={styles.centerSubtitle}>Carregando informações do paciente...</Text>
					</View>
				) : query.isError ? (
					<View style={styles.centerContent}>
						<Ionicons name="warning" size={24} color="#DC2626" />
						<Text style={styles.centerTitle}>Não foi possível carregar os dados</Text>
						<Text style={styles.centerSubtitle}>
							Verifique sua conexão e tente novamente mais tarde.
						</Text>
					</View>
				) : notFound ? (
					<View style={styles.centerContent}>
						<Ionicons name="person-circle" size={40} color="#94A3B8" />
						<Text style={styles.centerTitle}>Paciente não encontrado</Text>
						<Text style={styles.centerSubtitle}>
							Este cadastro pode ter sido removido ou você não possui acesso.
						</Text>
					</View>
				) : detail ? (
					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
					>
						<View style={styles.heroCard}>
							<View style={styles.heroHeader}>
								<View style={[styles.heroBadge, { backgroundColor: STATUS_BADGE_COLORS[detail.status].bg }] }>
									<Text style={[styles.heroBadgeText, { color: STATUS_BADGE_COLORS[detail.status].text }] }>
										{STATUS_LABELS[detail.status]}
									</Text>
								</View>
								<View style={[styles.heroBadge, { backgroundColor: STAGE_BADGE_COLORS[detail.stage].bg }] }>
									<Text style={[styles.heroBadgeText, { color: STAGE_BADGE_COLORS[detail.stage].text }] }>
										{STAGE_LABELS[detail.stage]}
									</Text>
								</View>
							</View>
							<Text style={styles.patientName}>{detail.fullName}</Text>
							<Text style={styles.patientCpf}>CPF: {formatCpf(detail.cpf)}</Text>
						</View>

						<View style={styles.infoGroup}>
							<Text style={styles.groupTitle}>Informações clínicas</Text>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>Unidade</Text>
								<Text style={styles.infoValue}>{detail.clinicalUnit ?? "-"}</Text>
							</View>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>Tumor</Text>
								<Text style={styles.infoValue}>{detail.tumorType ?? "-"}</Text>
							</View>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>Data de nascimento</Text>
								<Text style={styles.infoValue}>{formatDate(detail.birthDate)}</Text>
							</View>
						</View>

						<View style={styles.infoGroup}>
							<Text style={styles.groupTitle}>Contatos</Text>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>Telefone</Text>
								<Text style={styles.infoValue}>{detail.phone ?? "-"}</Text>
							</View>
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>Emergência</Text>
								<Text style={styles.infoValue}>{detail.emergencyPhone ?? "-"}</Text>
							</View>

							{detail.contacts.length > 0 ? (
								<View style={styles.contactsList}>
									{detail.contacts.map((contact) => (
										<View key={contact.id} style={styles.contactCard}>
											<Text style={styles.contactName}>{contact.fullName}</Text>
											<Text style={styles.contactMeta}>{contact.relation || "Contato"}</Text>
											<Text style={styles.contactValue}>{contact.phone ?? "-"}</Text>
										</View>
									))}
								</View>
							) : null}
						</View>

						<View style={styles.infoGroup}>
							<Text style={styles.groupTitle}>Acompanhamento</Text>
							<View style={styles.inlineStats}>
								<View style={styles.statCard}>
									<Text style={styles.statValue}>{detail.alerts.length}</Text>
									<Text style={styles.statLabel}>Alertas ativos</Text>
								</View>
								<View style={styles.statCard}>
									<Text style={styles.statValue}>{detail.occurrences.length}</Text>
									<Text style={styles.statLabel}>Ocorrências</Text>
								</View>
							</View>
						</View>
					</ScrollView>
				) : null}
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
		fontSize: 20,
		fontWeight: "700",
		color: "#111827",
	},
	scroll: {
		flex: 1,
		marginTop: 20,
	},
	scrollContent: {
		paddingBottom: 64,
		gap: 20,
	},
	heroCard: {
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#F8FBFF",
		padding: 20,
		gap: 12,
	},
	heroHeader: {
		flexDirection: "row",
		gap: 8,
	},
	heroBadge: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	heroBadgeText: {
		fontSize: 12,
		fontWeight: "600",
	},
	patientName: {
		fontSize: 22,
		fontWeight: "700",
		color: "#0F172A",
	},
	patientCpf: {
		fontSize: 14,
		color: "#475569",
	},
	infoGroup: {
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
		padding: 18,
		gap: 14,
	},
	groupTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#111827",
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 12,
	},
	infoLabel: {
		fontSize: 13,
		color: "#475569",
	},
	infoValue: {
		fontSize: 13,
		fontWeight: "600",
		color: "#111827",
	},
	contactsList: {
		gap: 10,
	},
	contactCard: {
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#F9FAFB",
		padding: 12,
		gap: 4,
	},
	contactName: {
		fontSize: 14,
		fontWeight: "600",
		color: "#111827",
	},
	contactMeta: {
		fontSize: 12,
		color: "#64748B",
	},
	contactValue: {
		fontSize: 13,
		color: "#0F172A",
	},
	inlineStats: {
		flexDirection: "row",
		gap: 12,
	},
	statCard: {
		flex: 1,
		borderRadius: 14,
		backgroundColor: "#F3F6FD",
		paddingVertical: 16,
		paddingHorizontal: 12,
		alignItems: "center",
		gap: 6,
	},
	statValue: {
		fontSize: 18,
		fontWeight: "700",
		color: "#1D4ED8",
	},
	statLabel: {
		fontSize: 12,
		color: "#475569",
		textAlign: "center",
	},
	centerContent: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		paddingHorizontal: 32,
	},
	centerTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#111827",
		textAlign: "center",
	},
	centerSubtitle: {
		fontSize: 13,
		color: "#475569",
		lineHeight: 18,
		textAlign: "center",
	},
});

export default ProfessionalPatientDetailScreen;
