import { Container } from "@/components/container";
import { Ionicons } from "@expo/vector-icons";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useRouter } from "expo-router";

const ACTIONS = [
	{
		id: "appointments",
		title: "Meus atendimentos",
		description: "Veja seus próximos atendimentos do dia.",
		icon: "people" as const,
	},
	{
		id: "patients",
		title: "Meus pacientes",
		description: "Todos os seus pacientes em um só lugar.",
		icon: "people-circle" as const,
	},
];

const ProfessionalWorkspaceScreen = () => {
	const router = useRouter();
	const patientsRoute = "/(professional)/patients" as const;
	const appointmentsRoute = "/(professional)/appointments" as const;

	return (
		<Container>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						activeOpacity={0.8}
						onPress={() => router.replace("/(professional)/(tabs)")}
					>
						<Ionicons name="arrow-back" size={22} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Área do profissional</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Atendimentos e pacientes</Text>
					<View style={styles.cardList}>
						{ACTIONS.map((action) => (
							<TouchableOpacity
								key={action.id}
								style={styles.card}
								activeOpacity={0.85}
								onPress={() => {
									if (action.id === "patients") {
										router.push(patientsRoute as never);
										return;
									}

									if (action.id === "appointments") {
										router.push(appointmentsRoute as never);
									}
								}}
							>
								<View style={styles.cardIcon}>
									<Ionicons name={action.icon} size={24} color="#2563EB" />
								</View>
								<View style={styles.cardContent}>
									<Text style={styles.cardTitle}>{action.title}</Text>
									<Text style={styles.cardDescription}>{action.description}</Text>
								</View>
							</TouchableOpacity>
						))}
					</View>
				</View>
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
		paddingBottom: 40,
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
	},
	section: {
		gap: 16,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#111827",
	},
	cardList: {
		gap: 12,
	},
	card: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#BFDBFE",
		padding: 16,
		gap: 16,
		backgroundColor: "#FFFFFF",
	},
	cardIcon: {
		width: 48,
		height: 48,
		borderRadius: 16,
		backgroundColor: "#EEF2FF",
		alignItems: "center",
		justifyContent: "center",
	},
	cardContent: {
		flex: 1,
		gap: 4,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2937",
	},
	cardDescription: {
		fontSize: 13,
		color: "#64748B",
		lineHeight: 18,
	},
});

export default ProfessionalWorkspaceScreen;
