import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
	ActivityIndicator,
	Image,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	ScrollView,
	Keyboard,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export default function ProfessionalLogin() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	const queryClient = useQueryClient();
	const bottomInset = useMemo(() => (insets.bottom > 0 ? insets.bottom : 12), [insets.bottom]);
	const bottomContainerStyle = useMemo(
		() => [styles.bottomContainer, { paddingBottom: 40 + bottomInset, marginBottom: keyboardHeight }],
		[bottomInset, keyboardHeight],
	);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const showSubscription = Keyboard.addListener(showEvent, (event) => {
			const height = event?.endCoordinates?.height ?? 0;
			setKeyboardHeight(height);
		});
		const hideSubscription = Keyboard.addListener(hideEvent, () => {
			setKeyboardHeight(0);
		});
		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, []);
	const handleGoBack = useCallback(() => {
		router.replace("/(drawer)");
	}, [router]);

	const isFormValid = useMemo(() => {
		return email.trim().length > 0 && password.trim().length > 0;
	}, [email, password]);

	const handleLogin = async () => {
		if (!isFormValid || isLoading) {
			return;
		}

		setIsLoading(true);
		setError(null);

		await authClient.signIn.email(
			{ email, password },
			{
				onError: (authError) => {
					setError(authError.error?.message || "Não foi possível realizar o login. Tente novamente.");
					setIsLoading(false);
				},
				onSuccess: () => {
					queryClient.refetchQueries();
					setEmail("");
					setPassword("");
					router.replace("/(professional)/(tabs)");
				},
				onFinished: () => {
					setIsLoading(false);
				},
			},
		);
	};

	return (
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.contentContainer}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				bounces={false}
			>
					<View style={styles.topContainer}>
						<TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
							<Ionicons name="arrow-back" size={26} color="#FFFFFF" />
						</TouchableOpacity>
						<View style={styles.logoWrapper}>
							<Image
								source={require("../../assets/images/healthcross.png")}
								style={styles.logo}
								resizeMode="contain"
							/>
						</View>
					</View>

					<View style={bottomContainerStyle}>
						<Text style={styles.title}>Vamos começar!</Text>
						<Text style={styles.subtitle}>Digite seu e-mail e senha</Text>

						<View style={styles.inputGroup}>
							<View style={styles.inputField}>
								<Ionicons name="mail-outline" size={18} color="#6B7280" style={{ marginRight: 12 }} />
								<TextInput
									style={styles.input}
									placeholder="E-mail"
									placeholderTextColor="#9CA3AF"
									autoCapitalize="none"
									keyboardType="email-address"
									value={email}
									onChangeText={setEmail}
								/>
							</View>

							<View style={styles.inputField}>
								<Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={{ marginRight: 12 }} />
								<TextInput
									style={styles.input}
									placeholder="Senha de acesso"
									placeholderTextColor="#9CA3AF"
									secureTextEntry
									value={password}
									onChangeText={setPassword}
								/>
							</View>
						</View>

						{error && (
							<View style={styles.errorBanner}>
								<Ionicons name="warning-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
								<Text style={styles.errorText}>{error}</Text>
							</View>
						)}

						<TouchableOpacity style={styles.forgotWrapper} activeOpacity={0.7}>
							<Text style={styles.forgotPassword}>Esqueceu sua senha?</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.primaryButton, isFormValid ? styles.primaryButtonEnabled : styles.primaryButtonDisabled]}
							activeOpacity={0.9}
							disabled={!isFormValid || isLoading}
							onPress={handleLogin}
						>
							{isLoading ? (
								<ActivityIndicator size="small" color="#FFFFFF" />
							) : (
								<Text style={styles.primaryButtonText}>Acessar</Text>
							)}
						</TouchableOpacity>
					</View>

			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#0E47A1",
	},
	contentContainer: {
		flexGrow: 1,
		justifyContent: "space-between",
	},
	topContainer: {
		alignItems: "center",
		justifyContent: "center",
		paddingTop: 32,
		paddingHorizontal: 24,
		paddingBottom: 16,
	},
	backButton: {
		position: "absolute",
		top: 32,
		left: 24,
		padding: 4,
	},
	logoWrapper: {
		alignItems: "center",
		justifyContent: "center",
		marginTop: -24,
	},
	logo: {
		width: 120,
		height: 120,
	},
	bottomContainer: {
		backgroundColor: "#FFFFFF",
		borderTopLeftRadius: 36,
		borderTopRightRadius: 36,
		paddingHorizontal: 28,
		paddingTop: 40,
	},
	title: {
		textAlign: "center",
		fontSize: 20,
		fontWeight: "700",
		color: "#1F2933",
	},
	subtitle: {
		marginTop: 12,
		textAlign: "center",
		fontSize: 14,
		color: "#6B7280",
	},
	inputGroup: {
		marginTop: 32,
	},
	errorBanner: {
		marginTop: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#FECACA",
		backgroundColor: "#FEF2F2",
		flexDirection: "row",
		alignItems: "center",
	},
	errorText: {
		flex: 1,
		color: "#B91C1C",
		fontSize: 14,
	},
	inputField: {
		marginBottom: 16,
		height: 52,
		borderRadius: 14,
		backgroundColor: "#F8FAFC",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
	},
	input: {
		flex: 1,
		fontSize: 15,
		color: "#111827",
	},
	forgotPassword: {
		textAlign: "right",
		color: "#3376F5",
		fontSize: 14,
		fontWeight: "500",
	},
	forgotWrapper: {
		marginTop: 16,
		alignSelf: "flex-end",
		width: "100%",
	},
	primaryButton: {
		marginTop: 28,
		height: 48,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#2F66F5",
	},
	primaryButtonDisabled: {
		opacity: 0.6,
	},
	primaryButtonEnabled: {
		opacity: 1,
	},
	primaryButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
});
