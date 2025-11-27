import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
	Image,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	StyleSheet,
	Platform,
	ActivityIndicator,
	ScrollView,
	Keyboard,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, loginPatientWithPin } from "@/lib/api";

const CODE_LENGTH = 4;

function formatCpf(value: string) {
	const digits = value.replace(/\D/g, "").slice(0, 11);
	const part1 = digits.slice(0, 3);
	const part2 = digits.slice(3, 6);
	const part3 = digits.slice(6, 9);
	const part4 = digits.slice(9, 11);

	let formatted = "";
	if (part1) {
		formatted = part1;
	}
	if (part2) {
		formatted += `${formatted ? "." : ""}${part2}`;
	}
	if (part3) {
		formatted += `${formatted ? "." : ""}${part3}`;
	}
	if (part4) {
		formatted += `${formatted ? "-" : ""}${part4}`;
	}

	return formatted;
}

export default function PatientLogin() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [cpf, setCpf] = useState("");
	const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
	const inputRefs = useRef<Array<TextInput | null>>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
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

	const sanitizedCpf = useMemo(() => cpf.replace(/\D/g, ""), [cpf]);
	const isCpfComplete = sanitizedCpf.length === 11;
	const isCodeComplete = useMemo(
		() => code.every((digit) => digit.trim().length === 1),
		[code],
	);
	const pin = useMemo(() => code.join(""), [code]);
	const isFormValid = isCpfComplete && isCodeComplete && !isSubmitting;

	const handleCpfChange = (value: string) => {
		const digits = value.replace(/\D/g, "").slice(0, 11);
		setCpf(formatCpf(digits));
		if (errorMessage) {
			setErrorMessage(null);
		}
	};

	const handleDigitChange = (value: string, index: number) => {
		const sanitized = value.replace(/\D/g, "").slice(-1);
		setCode((prev) => {
			const next = [...prev];
			next[index] = sanitized;
			return next;
		});

		if (errorMessage) {
			setErrorMessage(null);
		}

		if (sanitized && index < CODE_LENGTH - 1) {
			setTimeout(() => inputRefs.current[index + 1]?.focus(), 10);
		}
	};

	const handleConfirm = async () => {
		if (!isFormValid) {
			return;
		}

		setIsSubmitting(true);
		setErrorMessage(null);
		inputRefs.current.forEach((input) => input?.blur());

		try {
			await loginPatientWithPin({
				cpf: sanitizedCpf,
				pin,
			});
			router.replace("/(drawer)/(tabs)");
		} catch (error) {
			if (error instanceof ApiError) {
				setErrorMessage(error.response?.message ?? "Não foi possível acessar. Tente novamente.");
			} else {
				setErrorMessage("Não foi possível acessar. Verifique sua conexão e tente novamente.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyPress = (event: { nativeEvent: { key: string } }, index: number) => {
		if (event.nativeEvent.key !== "Backspace") {
			return;
		}

		const previousIndex = index > 0 ? index - 1 : 0;
		setCode((prev) => {
			const next = [...prev];
			if (next[index]) {
				next[index] = "";
			} else if (index > 0) {
				next[previousIndex] = "";
			}
			return next;
		});

		if (errorMessage) {
			setErrorMessage(null);
		}

		setTimeout(() => inputRefs.current[previousIndex]?.focus(), 10);
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
						<TouchableOpacity
							style={styles.backButton}
							onPress={() => router.back()}
						>
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
						<Text style={styles.subtitle}>Digite seu código de verificação</Text>

						<View style={styles.inputGroup}>
							<Text style={styles.inputLabel}>CPF</Text>
							<TextInput
								style={styles.cpfInput}
								keyboardType="number-pad"
								maxLength={14}
								value={cpf}
								onChangeText={handleCpfChange}
								placeholder="000.000.000-00"
								placeholderTextColor="#9CA3AF"
								returnKeyType="next"
								onSubmitEditing={() => inputRefs.current[0]?.focus()}
							/>
						</View>

						<View style={styles.codeContainer}>
							{code.map((digit, index) => (
								<TextInput
									key={index}
									ref={(ref) => {
										inputRefs.current[index] = ref;
									}}
									style={styles.codeInput}
									keyboardType="number-pad"
									maxLength={1}
									value={digit}
									onChangeText={(value) => handleDigitChange(value, index)}
									onKeyPress={(event) => handleKeyPress(event, index)}
									selectionColor="#0E47A1"
									returnKeyType="done"
									onSubmitEditing={() => {
										if (index === CODE_LENGTH - 1) {
											handleConfirm();
										}
									}}
								/>
							))}
						</View>

						{errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

						<TouchableOpacity
							style={[
								styles.primaryButton,
								isFormValid ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
							]}
							onPress={handleConfirm}
							disabled={!isFormValid}
						>
							{isSubmitting ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text style={styles.primaryButtonText}>Confirmar</Text>
							)}
						</TouchableOpacity>

						<TouchableOpacity style={styles.helpWrapper} activeOpacity={0.7}>
							<Text style={styles.helpText}>Precisa de ajuda para acessar?</Text>
						</TouchableOpacity>

						<TouchableOpacity style={styles.secondaryButton}>
							<Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
							<Text style={styles.secondaryButtonText}>Ligar para a clínica</Text>
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
		width: 140,
		height: 140,
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
	codeContainer: {
		marginTop: 28,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	codeInput: {
		height: 64,
		width: 64,
		borderRadius: 16,
		backgroundColor: "#F1F5F9",
		textAlign: "center",
		fontSize: 24,
		color: "#0E47A1",
	},
	primaryButton: {
		marginTop: 32,
		height: 48,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	primaryButtonDisabled: {
		backgroundColor: "#9CA3AF",
	},
	primaryButtonEnabled: {
		backgroundColor: "#2F66F5",
	},
	primaryButtonText: {
		color: "#FFFFFF",
		fontWeight: "600",
		fontSize: 16,
	},
	helpWrapper: {
		marginTop: 24,
		alignItems: "center",
	},
	helpText: {
		color: "#3376F5",
		fontSize: 15,
		fontWeight: "500",
	},
	secondaryButton: {
		marginTop: 16,
		backgroundColor: "#1ABC4B",
		height: 48,
		borderRadius: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	secondaryButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
	inputGroup: {
		marginTop: 28,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1F2933",
		marginBottom: 8,
	},
	cpfInput: {
		height: 52,
		borderRadius: 14,
		backgroundColor: "#F1F5F9",
		paddingHorizontal: 16,
		fontSize: 18,
		color: "#0E47A1",
	},
	errorText: {
		marginTop: 16,
		textAlign: "center",
		color: "#DC2626",
		fontSize: 14,
	},
});
