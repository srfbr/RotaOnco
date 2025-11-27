import { Container } from "@/components/container";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, fetchProfessionalProfile, updateProfessionalProfile } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "expo-router";
import {
	ActivityIndicator,
	Alert,
	Image,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

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

const MAX_AVATAR_BYTES = 1_000_000; // keep in sync with server validation

const ProfessionalEditProfileScreen = () => {
	const router = useRouter();
	const queryClient = useQueryClient();
	const session = authClient.useSession();
	const isAuthenticated = Boolean(session.data);
	const [name, setName] = useState("");
	const [specialty, setSpecialty] = useState("");
	const [phone, setPhone] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
	const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
	const [avatarDirty, setAvatarDirty] = useState(false);
	const [isPickingAvatar, setIsPickingAvatar] = useState(false);

	const {
		data: profile,
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: ["professional", "profile"],
		queryFn: fetchProfessionalProfile,
		staleTime: 5 * 60 * 1000,
		enabled: isAuthenticated,
	});

	useEffect(() => {
		if (!profile) {
			return;
		}
		setName(profile.name ?? "");
		setSpecialty(profile.specialty ?? "");
		setPhone(profile.phone ?? "");
		setFormError(null);
		setAvatarPreviewUri(profile.avatarUrl ?? null);
		setAvatarDataUrl(null);
		setAvatarDirty(false);
		setIsPickingAvatar(false);
	}, [profile?.id, profile?.name, profile?.specialty, profile?.phone, profile?.avatarUrl]);

	useEffect(() => {
		setFormError(null);
	}, [name, specialty, phone, avatarDirty, avatarDataUrl]);

	const mutation = useMutation({
		mutationFn: updateProfessionalProfile,
		onSuccess: (data) => {
			queryClient.setQueryData(["professional", "profile"], data);
			Alert.alert("Perfil atualizado", "Seus dados foram atualizados com sucesso.");
			router.back();
		},
		onError: (err) => {
			const message =
				err instanceof ApiError
					? err.message
					: "Não foi possível atualizar o perfil. Tente novamente.";
			setFormError(message);
		},
	});

	const initials = useMemo(() => getInitials(profile?.name), [profile?.name]);
	const loadErrorMessage =
		error instanceof Error
			? error.message
			: "Não foi possível carregar os dados do perfil.";
	const isSubmitting = mutation.isPending;
	const avatarPreview = useMemo(
		() => avatarPreviewUri ?? profile?.avatarUrl ?? null,
		[avatarPreviewUri, profile?.avatarUrl],
	);
	const canRemoveAvatar = useMemo(
		() => Boolean(avatarPreview && (avatarDirty || profile?.avatarUrl)),
		[avatarPreview, avatarDirty, profile?.avatarUrl],
	);
	const isBusy = isSubmitting || isPickingAvatar;

	const handlePickAvatar = useCallback(async () => {
		try {
			setFormError(null);
			setIsPickingAvatar(true);
			const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
			console.log("Image picker permission", {
				status: permission.status,
				granted: permission.granted,
				canAskAgain: permission.canAskAgain,
			});
			const hasPermission = permission.granted || permission.canAskAgain || permission.status === "undetermined";
			if (!hasPermission) {
				setFormError("Precisamos da permissão para acessar suas fotos.");
				return;
			}
			if (!permission.granted) {
				const finalPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
				if (!finalPermission.granted) {
					setFormError("Precisamos da permissão para acessar suas fotos.");
					return;
				}
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.8,
				base64: true,
			});
			console.log("Image picker result", {
				canceled: result.canceled,
				totalAssets: result.assets?.length ?? 0,
			});

			if (result.canceled || !result.assets || result.assets.length === 0) {
				return;
			}

			const asset = result.assets[0];
			console.log("Image picker asset", {
				uri: asset?.uri,
				fileSize: asset?.fileSize,
				base64Length: asset?.base64?.length ?? 0,
				mimeType: asset?.mimeType,
			});
			if (!asset) {
				setFormError("Não foi possível processar a imagem selecionada.");
				return;
			}

			let base64 = asset.base64 ?? null;
			let fileSize: number | null = typeof asset.fileSize === "number" ? asset.fileSize : null;
			if (fileSize !== null && fileSize > MAX_AVATAR_BYTES) {
				setFormError("Imagem deve ter no máximo 1MB.");
				return;
			}

			if (asset.uri) {
				try {
					if (Platform.OS === "web") {
						const response = await fetch(asset.uri);
						if (!response.ok) {
							throw new Error("Falha ao acessar a imagem selecionada.");
						}
						const blob = await response.blob();
						fileSize = blob.size;
						if (blob.size > MAX_AVATAR_BYTES) {
							setFormError("Imagem deve ter no máximo 1MB.");
							return;
						}
						if (!base64) {
							if (!("FileReader" in globalThis)) {
								throw new Error("Não foi possível processar a imagem selecionada.");
							}
							base64 = await new Promise<string>((resolve, reject) => {
								const reader = new FileReader();
								reader.onerror = () =>
									reject(new Error("Não foi possível processar a imagem selecionada."));
								reader.onloadend = () => {
									const result = reader.result;
									if (typeof result !== "string") {
										reject(new Error("Não foi possível processar a imagem selecionada."));
										return;
									}
									const commaIndex = result.indexOf(",");
									resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
								};
								reader.readAsDataURL(blob);
							});
						}
					} else {
						const info = await FileSystem.getInfoAsync(asset.uri);
						if (info.exists && typeof info.size === "number") {
							fileSize = info.size;
							if (info.size > MAX_AVATAR_BYTES) {
								setFormError("Imagem deve ter no máximo 1MB.");
								return;
							}
						}
						if (!base64) {
							base64 = await FileSystem.readAsStringAsync(asset.uri, {
								encoding: FileSystem.EncodingType.Base64,
							});
						}
					}
				} catch (fsError) {
					console.error("Falha ao processar imagem selecionada", fsError, {
						sourceUri: asset.uri,
					});
					// fallback to original base64 if available
					if (!base64) {
						setFormError("Não foi possível processar a imagem selecionada.");
						return;
					}
				}
			}

			if (!base64) {
				setFormError("Não foi possível processar a imagem selecionada.");
				return;
			}

			const estimatedBytes = Math.floor((base64.length * 3) / 4);
			if ((fileSize ?? estimatedBytes) > MAX_AVATAR_BYTES || estimatedBytes > MAX_AVATAR_BYTES) {
				setFormError("Imagem deve ter no máximo 1MB.");
				return;
			}

			const mimeType =
				asset.mimeType && asset.mimeType.startsWith("image/")
					? asset.mimeType === "image/jpg"
						? "image/jpeg"
						: asset.mimeType
					: "image/jpeg";
			const dataUrl = `data:${mimeType};base64,${base64}`;

			setAvatarPreviewUri(asset.uri ?? dataUrl);
			setAvatarDataUrl(dataUrl);
			setAvatarDirty(true);
		} catch (pickError) {
			console.error("Erro ao selecionar imagem de avatar", pickError);
			setFormError("Não foi possível selecionar a imagem. Tente novamente.");
		} finally {
			setIsPickingAvatar(false);
		}
	}, []);

	const handleRemoveAvatar = useCallback(() => {
		if (!profile?.avatarUrl && !avatarPreview) {
			return;
		}
		setFormError(null);
		setAvatarPreviewUri(null);
		setAvatarDataUrl(null);
		setAvatarDirty(true);
	}, [profile?.avatarUrl, avatarPreview]);

	const handleSubmit = useCallback(() => {
		if (!profile) {
			return;
		}

		const payload: Parameters<typeof updateProfessionalProfile>[0] = {};

		const trimmedName = name.trim();
		if (trimmedName.length < 3) {
			setFormError("Informe um nome com ao menos 3 caracteres.");
			return;
		}
		if (trimmedName !== profile.name) {
			payload.name = trimmedName;
		}

		const trimmedSpecialty = specialty.trim();
		const normalizedSpecialty = trimmedSpecialty.length === 0 ? null : trimmedSpecialty;
		if ((profile.specialty ?? null) !== (normalizedSpecialty ?? null)) {
			if (normalizedSpecialty && normalizedSpecialty.length < 2) {
				setFormError("Informe uma especialidade com ao menos 2 caracteres.");
				return;
			}
			payload.specialty = normalizedSpecialty;
		}

		const trimmedPhone = phone.trim();
		const normalizedPhoneDigits = trimmedPhone.replace(/\D/g, "");
		const currentPhoneDigits = (profile.phone ?? "").replace(/\D/g, "");
		if (trimmedPhone.length === 0) {
			if (profile.phone) {
				payload.phone = null;
			}
		} else {
			if (normalizedPhoneDigits.length < 10) {
				setFormError("Telefone deve conter ao menos 10 dígitos.");
				return;
			}
			if (normalizedPhoneDigits !== currentPhoneDigits) {
				payload.phone = trimmedPhone;
			}
		}

		if (avatarDirty) {
			const currentAvatar = profile.avatarUrl ?? null;
			if (!avatarDataUrl && currentAvatar) {
				payload.avatarDataUrl = null;
			} else if (avatarDataUrl && avatarDataUrl !== currentAvatar) {
				payload.avatarDataUrl = avatarDataUrl;
			}
		}

		if (Object.keys(payload).length === 0) {
			setFormError("Nenhuma alteração encontrada para atualizar.");
			return;
		}

		mutation.mutate(payload);
	}, [
		profile,
		name,
		specialty,
		phone,
		avatarDirty,
		avatarDataUrl,
		mutation,
	]);

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
						onPress={() => router.back()}
						disabled={isBusy}
					>
						<Ionicons name="arrow-back" size={22} color="#111827" />
					</TouchableOpacity>
					<Text style={styles.title}>Editar perfil</Text>
				</View>

				{isLoading ? (
					<View style={styles.loadingState}>
						<ActivityIndicator size="small" color="#2563EB" />
						<Text style={styles.loadingText}>Carregando dados do perfil...</Text>
					</View>
				) : isError ? (
					<View style={styles.errorState}>
						<Ionicons name="warning" size={20} color="#B91C1C" />
						<Text style={styles.errorText}>{loadErrorMessage}</Text>
						<TouchableOpacity
							style={styles.retryButton}
							activeOpacity={0.85}
							onPress={() => refetch()}
						>
							<Text style={styles.retryButtonText}>Tentar novamente</Text>
						</TouchableOpacity>
					</View>
				) : profile ? (
					<>
						<View style={styles.profileWrapper}>
							<View style={styles.avatarWrapper}>
								<View style={styles.avatar}>
									{avatarPreview ? (
										<Image
											source={{ uri: avatarPreview }}
											style={styles.avatarImage}
											resizeMode="contain"
										/>
									) : (
										<Text style={styles.avatarInitials}>{initials}</Text>
									)}
									{isPickingAvatar ? (
										<View style={styles.avatarOverlay}>
											<ActivityIndicator size="small" color="#FFFFFF" />
										</View>
									) : null}
								</View>
								<TouchableOpacity
									style={styles.cameraButton}
									activeOpacity={0.85}
									onPress={handlePickAvatar}
									disabled={isBusy}
								>
									<Ionicons name="camera" size={16} color="#FFFFFF" />
								</TouchableOpacity>
							</View>
							{canRemoveAvatar ? (
								<TouchableOpacity
									style={styles.removeAvatarButton}
									activeOpacity={0.8}
									onPress={handleRemoveAvatar}
									disabled={isBusy}
								>
									<Ionicons name="trash-outline" size={16} color="#DC2626" />
									<Text style={styles.removeAvatarText}>Remover foto</Text>
								</TouchableOpacity>
							) : null}
						</View>

						<View style={styles.form}>
							{formError ? (
								<View style={styles.formErrorBox}>
									<Text style={styles.formErrorText}>{formError}</Text>
								</View>
							) : null}

							<View style={styles.inputGroup}>
								<Ionicons name="person" size={18} color="#94A3B8" />
								<TextInput
									style={styles.input}
									value={name}
									onChangeText={setName}
									placeholder="Nome completo"
									placeholderTextColor="#94A3B8"
									autoCapitalize="words"
									editable={!isBusy}
								/>
							</View>

							<View style={styles.inputGroup}>
								<Ionicons name="briefcase" size={18} color="#94A3B8" />
								<TextInput
									style={styles.input}
									value={specialty}
									onChangeText={setSpecialty}
									placeholder="Especialidade"
									placeholderTextColor="#94A3B8"
									autoCapitalize="sentences"
									editable={!isBusy}
								/>
							</View>

							<View style={styles.inputGroup}>
								<Ionicons name="call" size={18} color="#94A3B8" />
								<TextInput
									style={styles.input}
									value={phone}
									onChangeText={setPhone}
									placeholder="Telefone com DDD"
									placeholderTextColor="#94A3B8"
									keyboardType="phone-pad"
									editable={!isBusy}
								/>
							</View>

							<View style={styles.readonlyGroup}>
								<Ionicons name="mail" size={18} color="#94A3B8" />
								<View style={styles.readonlyContent}>
									<Text style={styles.readonlyLabel}>E-mail</Text>
									<Text style={styles.readonlyValue}>{profile.email || "-"}</Text>
								</View>
							</View>

							<View style={styles.readonlyGroup}>
								<Ionicons name="document-text-outline" size={18} color="#94A3B8" />
								<View style={styles.readonlyContent}>
									<Text style={styles.readonlyLabel}>Documento</Text>
									<Text style={styles.readonlyValue}>{profile.documentId}</Text>
								</View>
							</View>
						</View>

						<View style={styles.actions}>
							<TouchableOpacity
								style={[
									styles.updateButton,
									isBusy ? styles.updateButtonDisabled : null,
								]}
								activeOpacity={0.9}
								onPress={handleSubmit}
								disabled={isBusy}
							>
								{isSubmitting ? (
									<ActivityIndicator size="small" color="#FFFFFF" />
								) : (
									<Text style={styles.updateButtonText}>Atualizar</Text>
								)}
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.cancelButton,
									isBusy ? styles.cancelButtonDisabled : null,
								]}
								activeOpacity={0.85}
								onPress={() => router.back()}
								disabled={isBusy}
							>
								<Text style={styles.cancelButtonText}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</>
				) : (
					<View style={styles.emptyState}>
						<Text style={styles.emptyStateText}>Perfil não disponível.</Text>
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
	profileWrapper: {
		alignItems: "center",
		gap: 12,
	},
	avatarWrapper: {
		position: "relative",
	},
	avatar: {
		width: 112,
		height: 112,
		borderRadius: 56,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#2563EB",
		overflow: "hidden",
	},
	avatarImage: {
		width: "100%",
		height: "100%",
	},
	avatarInitials: {
		fontSize: 40,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	avatarOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(17, 24, 39, 0.45)",
		alignItems: "center",
		justifyContent: "center",
	},
	cameraButton: {
		position: "absolute",
		bottom: 4,
		right: 4,
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#2563EB",
		borderWidth: 2,
		borderColor: "#FFFFFF",
		elevation: 4,
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
	},
	removeAvatarButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	removeAvatarText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#DC2626",
	},
	form: {
		gap: 16,
	},
	formErrorBox: {
		borderRadius: 14,
		borderWidth: 1,
		borderColor: "#FCD34D",
		backgroundColor: "#FEFCE8",
		padding: 12,
	},
	formErrorText: {
		fontSize: 13,
		color: "#92400E",
		textAlign: "center",
	},
	inputGroup: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		paddingHorizontal: 16,
		height: 54,
		backgroundColor: "#FFFFFF",
	},
	input: {
		flex: 1,
		fontSize: 15,
		color: "#111827",
	},
	readonlyGroup: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#F8FAFC",
	},
	readonlyContent: {
		flex: 1,
		gap: 2,
	},
	readonlyLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: "#64748B",
		textTransform: "uppercase",
	},
	readonlyValue: {
		fontSize: 15,
		color: "#111827",
	},
	actions: {
		gap: 12,
		marginTop: 8,
	},
	updateButton: {
		height: 52,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#2563EB",
	},
	updateButtonDisabled: {
		opacity: 0.7,
	},
	updateButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	cancelButton: {
		height: 52,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
	},
	cancelButtonDisabled: {
		opacity: 0.7,
	},
	cancelButtonText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#111827",
	},
	emptyState: {
		marginTop: 48,
		alignItems: "center",
	},
	emptyStateText: {
		fontSize: 14,
		color: "#475569",
	},
});

export default ProfessionalEditProfileScreen;
