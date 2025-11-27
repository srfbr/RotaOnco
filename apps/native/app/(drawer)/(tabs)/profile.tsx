import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import type { AVPlaybackSource, AVPlaybackStatus } from "expo-av";

import { Container } from "@/components/container";

const formatDurationLabel = (durationMillis?: number | null) => {
	if (!durationMillis || durationMillis <= 0) {
		return "...";
	}
	const totalSeconds = Math.round(durationMillis / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		const minutesPart = minutes > 0 ? ` ${minutes} min` : "";
		return `${hours} h${minutesPart}`.trim();
	}
	if (minutes >= 1) {
		return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
	}
	return `${seconds} s`;
};

type AudioTrack = {
	id: string;
	title: string;
	description: string;
	source: AVPlaybackSource;
};

export default function HowItWorks() {
	const router = useRouter();

	const audioTracks = useMemo<AudioTrack[]>(
		() => [
			{
				id: "how-it-works-intro",
				title: "ROTA+NCO",
				description: "Toque aqui e ouça as instruções.",
				source: require("@/assets/audio/luvvoice.com-20251125-SmFcUW.mp3"),
			},
		],
		[],
	);

	const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
	const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
	const [trackDurations, setTrackDurations] = useState<Record<string, string>>({});
	const soundRef = useRef<Audio.Sound | null>(null);

	const unloadSound = useCallback(async () => {
		if (!soundRef.current) {
			return;
		}
		try {
			await soundRef.current.unloadAsync();
		} catch (error) {
			console.error("Failed to unload audio", error);
		} finally {
			soundRef.current = null;
		}
	}, []);

	const goToHome = useCallback(() => {
		unloadSound().catch(() => {
			// ignore cleanup failure before navigating
		});
		router.replace("/(drawer)/(tabs)");
	}, [router, unloadSound]);

	useEffect(() => {
		Audio.setAudioModeAsync({
			allowsRecordingIOS: false,
			playsInSilentModeIOS: true,
			shouldDuckAndroid: true,
			staysActiveInBackground: false,
		}).catch((error) => {
			console.warn("Audio mode setup failed", error);
		});

		return () => {
			unloadSound().catch(() => {
				// noop cleanup fallback
			});
		};
	}, [unloadSound]);

	useEffect(() => {
		let isMounted = true;
		(async () => {
			for (const track of audioTracks) {
				try {
					const { sound, status } = await Audio.Sound.createAsync(track.source, { shouldPlay: false });
					if (status.isLoaded && isMounted) {
						setTrackDurations((prev) => ({
							...prev,
							[track.id]: formatDurationLabel(status.durationMillis ?? null),
						}));
					}
					await sound.unloadAsync();
				} catch (error) {
					console.warn("Failed to read audio duration", error);
				}
			}
		})();
		return () => {
			isMounted = false;
		};
	}, [audioTracks]);

	const handlePlaybackStatus = useCallback(
		(status: AVPlaybackStatus) => {
			if (!status.isLoaded) {
				if ((status as { error?: string }).error) {
					console.error("Playback error", (status as { error?: string }).error);
				}
				return;
			}
			if (status.didJustFinish) {
				setActiveTrackId(null);
				unloadSound().catch(() => {
					// noop cleanup fallback
				});
			}
		},
		[unloadSound],
	);

	const handleTogglePlayback = useCallback(
		async (track: AudioTrack) => {
			if (loadingTrackId) {
				return;
			}
			setLoadingTrackId(track.id);
			try {
				if (activeTrackId === track.id) {
					await unloadSound();
					setActiveTrackId(null);
					return;
				}

				await unloadSound();
				const { sound, status } = await Audio.Sound.createAsync(track.source);
				soundRef.current = sound;
				sound.setOnPlaybackStatusUpdate(handlePlaybackStatus);
				setActiveTrackId(track.id);
				if (status.isLoaded) {
					setTrackDurations((prev) => ({
						...prev,
						[track.id]: formatDurationLabel(status.durationMillis ?? null),
					}));
				}
				await sound.playAsync();
			} catch (error) {
				console.error("Failed to play audio", error);
				setActiveTrackId(null);
				await unloadSound();
			} finally {
				setLoadingTrackId(null);
			}
		},
		[activeTrackId, handlePlaybackStatus, loadingTrackId, unloadSound],
	);

	return (
		<Container>
			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<Pressable onPress={goToHome} style={styles.backButton} accessibilityRole="button">
						<Ionicons name="arrow-back" size={20} color="#111827" />
					</Pressable>
					<Text style={styles.title}>Como funciona o app</Text>
				</View>

				<Text style={styles.sectionTitle}>Explicação em áudio</Text>
				{audioTracks.map((track) => {
					const isActive = activeTrackId === track.id;
					const isLoading = loadingTrackId === track.id;
					const durationLabel = trackDurations[track.id] ?? "...";
					return (
						<View key={track.id} style={[styles.card, isActive && styles.cardActive]}>
							<Pressable
								disabled={isLoading}
								onPress={() => handleTogglePlayback(track)}
								style={({ pressed }) => [
									styles.cardButton,
									pressed && !isLoading && styles.cardPressed,
								]}
								android_ripple={{ color: "rgba(37, 99, 235, 0.12)", borderless: false }}
							>
								<View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
									<Ionicons name="volume-high" size={28} color="#FFFFFF" />
								</View>
								<View style={styles.cardContent}>
									<Text style={styles.cardTitle}>{track.title}</Text>
									<Text style={styles.cardDescription}>
										{isLoading ? "Carregando áudio..." : track.description}
									</Text>
									<View style={styles.cardFooter}>
										<View style={styles.durationDot} />
										<Text style={styles.cardDuration}>{durationLabel}</Text>
									</View>
								</View>
							</Pressable>
						</View>
					);
				})}
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
		paddingTop: 32,
		paddingBottom: 48,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 24,
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#F3F4F6",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	title: {
		fontSize: 22,
		fontWeight: "700",
		color: "#0F172A",
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#111827",
		marginBottom: 18,
	},
	card: {
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#C7D7FE",
		backgroundColor: "#FFFFFF",
		marginBottom: 16,
		shadowColor: "#000000",
		shadowOpacity: 0.03,
		shadowOffset: { width: 0, height: 1 },
		shadowRadius: 2,
		elevation: 1,
		overflow: "hidden",
	},
	cardActive: {
		borderColor: "#3B7BFF",
		backgroundColor: "#EEF4FF",
	},
	cardButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 18,
		paddingVertical: 16,
		width: "100%",
	},
	cardPressed: {
		opacity: 0.92,
	},
	iconWrapper: {
		width: 60,
		height: 60,
		borderRadius: 18,
		backgroundColor: "#2563EB",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 18,
	},
	iconWrapperActive: {
		backgroundColor: "#1E46C0",
	},
	cardContent: {
		flex: 1,
	},
	cardTitle: {
		fontSize: 14,
		fontWeight: "700",
		color: "#2563EB",
		marginBottom: 4,
	},
	cardDescription: {
		fontSize: 13,
		color: "#1F2937",
		marginBottom: 8,
	},
	cardFooter: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 2,
	},
	durationDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "#9CA3AF",
		marginRight: 6,
	},
	cardDuration: {
		fontSize: 12,
		color: "#6B7280",
	},
});