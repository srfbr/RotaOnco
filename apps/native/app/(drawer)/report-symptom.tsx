import { Container } from "@/components/container";
import { ApiError, PatientOccurrence, reportPatientOccurrence } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type SymptomOption = {
	id: string;
	label: string;
	intensity: number;
};

type SymptomSection = {
	title: string;
	options: SymptomOption[];
};

const SYMPTOM_SECTIONS: readonly SymptomSection[] = [
	{
		title: "Sintomas leves",
		options: [
			{ id: "mild-headache", label: "Dor de cabeça", intensity: 2 },
			{ id: "mild-nausea", label: "Náusea leve", intensity: 2 },
		],
	},
	{
		title: "Sintomas moderados",
		options: [
			{ id: "moderate-pain", label: "Dor intensa", intensity: 6 },
			{ id: "high-fever", label: "Febre alta", intensity: 6 },
		],
	},
	{
		title: "Sintomas críticos",
		options: [
			{ id: "chest-pain", label: "Dor no peito", intensity: 9 },
			{ id: "severe-dehydration", label: "Desidratação grave", intensity: 9 },
		],
	},
];

type SymptomId = SymptomOption["id"];

export default function ReportSymptomScreen() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [selected, setSelected] = useState<Set<SymptomId>>(new Set());
	const [showConfirmModal, setShowConfirmModal] = useState(false);

	const symptomMap = useMemo(() => {
		const map = new Map<SymptomId, SymptomOption>();
		for (const section of SYMPTOM_SECTIONS) {
			for (const option of section.options) {
				map.set(option.id, option);
			}
		}
		return map;
	}, []);

	const selectedOptions = useMemo(() => {
		return Array.from(selected)
			.map((id) => symptomMap.get(id))
			.filter((option): option is SymptomOption => Boolean(option));
	}, [selected, symptomMap]);

	const reportSymptomsMutation = useMutation<PatientOccurrence[], unknown, SymptomOption[]>({
		mutationFn: async (symptoms) => {
			const created: PatientOccurrence[] = [];
			for (const symptom of symptoms) {
				const occurrence = await reportPatientOccurrence({
					kind: symptom.label,
					intensity: symptom.intensity,
				});
				created.push(occurrence);
			}
			return created;
		},
		onSuccess: () => {
			setSelected(new Set());
			setShowConfirmModal(false);
			queryClient.invalidateQueries({ queryKey: ["patient", "home"] });
			queryClient.invalidateQueries({ queryKey: ["patient", "appointments"] });
			Alert.alert(
				"Sintoma enviado",
				"Notificamos a equipe médica e iremos acompanhar o seu relato.",
			);
		},
		onError: (error) => {
			const message =
				error instanceof ApiError
					? error.response?.message ?? "Não foi possível enviar o relato. Tente novamente."
					: "Não foi possível enviar o relato. Tente novamente.";
			Alert.alert("Erro", message);
		},
	});

	const toggleSymptom = (id: SymptomId) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleConfirm = () => {
		if (selectedOptions.length === 0) {
			Alert.alert("Selecione um sintoma", "Escolha ao menos um sintoma para prosseguir.");
			return;
		}
		setShowConfirmModal(true);
	};

	const handleSend = async () => {
		if (selectedOptions.length === 0 || reportSymptomsMutation.isPending) {
			return;
		}
		try {
			await reportSymptomsMutation.mutateAsync(selectedOptions);
		} catch {
			// handled in onError
		}
	};

	const handleCloseModal = () => {
		if (reportSymptomsMutation.isPending) {
			return;
		}
		setShowConfirmModal(false);
	};

	const isSubmitDisabled = selectedOptions.length === 0 || reportSymptomsMutation.isPending;

	return (
		<Container>
			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						activeOpacity={0.8}
						onPress={() => router.back()}
					>
						<Ionicons name="arrow-back" size={20} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Relatar sintoma</Text>
				</View>

				{SYMPTOM_SECTIONS.map((section) => (
					<View key={section.title} style={styles.section}>
						<Text style={styles.sectionTitle}>{section.title}</Text>
						{section.options.map((option) => {
							const isSelected = selected.has(option.id);
							return (
								<TouchableOpacity
									key={option.id}
									style={[styles.symptomCard, isSelected && styles.symptomCardSelected]}
									activeOpacity={0.85}
									onPress={() => toggleSymptom(option.id)}
								>
									<Text style={styles.symptomText}>{option.label}</Text>
									<View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
										{isSelected ? (
											<Ionicons name="checkmark" size={16} color="#FFFFFF" />
										) : null}
									</View>
								</TouchableOpacity>
							);
						})}
					</View>
				))}
			</ScrollView>

			<View style={styles.footer}>
				<TouchableOpacity
					style={[styles.confirmButton, isSubmitDisabled && styles.confirmButtonDisabled]}
					activeOpacity={0.9}
					onPress={handleConfirm}
					disabled={isSubmitDisabled}
				>
					<Text style={styles.confirmButtonText}>Confirmar</Text>
				</TouchableOpacity>
			</View>

			<Modal
				transparent
				visible={showConfirmModal}
				animationType="fade"
				onRequestClose={handleCloseModal}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Notificar sintoma ao médico</Text>
						<Text style={styles.modalDescription}>
							Por favor, confirme clicando em "Enviar" para que possamos informar seu médico.
						</Text>
						{selectedOptions.length > 0 ? (
							<View style={styles.selectedSymptomList}>
								{selectedOptions.map((symptom) => (
									<Text key={symptom.id} style={styles.selectedSymptomItem}>
										• {symptom.label}
									</Text>
								))}
							</View>
						) : null}
						<TouchableOpacity
							style={[styles.modalPrimaryButton, reportSymptomsMutation.isPending && styles.modalPrimaryButtonDisabled]}
							activeOpacity={0.9}
							onPress={handleSend}
							disabled={reportSymptomsMutation.isPending}
						>
							<Text style={styles.modalPrimaryButtonText}>
								{reportSymptomsMutation.isPending ? "Enviando..." : "Enviar"}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalSecondaryButton, reportSymptomsMutation.isPending && styles.modalSecondaryButtonDisabled]}
							activeOpacity={0.9}
							onPress={handleCloseModal}
							disabled={reportSymptomsMutation.isPending}
						>
							<Text style={styles.modalSecondaryButtonText}>Voltar</Text>
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
		paddingTop: 24,
		paddingBottom: 32,
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
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#1F2933",
		marginBottom: 12,
	},
	symptomCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderWidth: 1,
		borderColor: "#C8D3F9",
		borderRadius: 16,
		paddingVertical: 14,
		paddingHorizontal: 18,
		marginBottom: 10,
		backgroundColor: "#FFFFFF",
	},
	symptomCardSelected: {
		borderColor: "#2F66F5",
	},
	symptomText: {
		fontSize: 15,
		color: "#1F2933",
		fontWeight: "500",
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: "#97A5D3",
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxSelected: {
		backgroundColor: "#2F66F5",
		borderColor: "#2F66F5",
	},
	footer: {
		paddingHorizontal: 24,
		paddingBottom: 32,
	},
	confirmButton: {
		width: "100%",
		backgroundColor: "#2F66F5",
		borderRadius: 16,
		paddingVertical: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	confirmButtonDisabled: {
		opacity: 0.5,
	},
	confirmButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
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
		paddingVertical: 28,
		paddingHorizontal: 24,
		alignItems: "center",
	},
	modalTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#1F2933",
		marginBottom: 12,
	},
	modalDescription: {
		fontSize: 13,
		color: "#6B7280",
		textAlign: "center",
		marginBottom: 24,
		lineHeight: 20,
	},
	selectedSymptomList: {
		alignSelf: "stretch",
		marginBottom: 16,
	},
	selectedSymptomItem: {
		fontSize: 14,
		color: "#1F2933",
		marginBottom: 4,
	},
	modalPrimaryButton: {
		width: "100%",
		backgroundColor: "#2F66F5",
		borderRadius: 16,
		paddingVertical: 14,
		alignItems: "center",
		marginBottom: 12,
	},
	modalPrimaryButtonDisabled: {
		opacity: 0.6,
	},
	modalPrimaryButtonText: {
		color: "#FFFFFF",
		fontWeight: "600",
		fontSize: 15,
	},
	modalSecondaryButton: {
		width: "100%",
		borderRadius: 16,
		paddingVertical: 14,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#D1D5DB",
	},
	modalSecondaryButtonDisabled: {
		opacity: 0.6,
	},
	modalSecondaryButtonText: {
		color: "#1F2933",
		fontWeight: "500",
		fontSize: 15,
	},
});
