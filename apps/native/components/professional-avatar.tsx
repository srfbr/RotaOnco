import { Ionicons } from "@expo/vector-icons";
import { Image, View } from "react-native";

export type ProfessionalAvatarProps = {
	uri?: string | null;
	size?: number;
	backgroundColor?: string;
	iconColor?: string;
};

export function ProfessionalAvatar({
	uri,
	size = 48,
	backgroundColor = "#E0EAFF",
	iconColor = "#1D4ED8",
}: ProfessionalAvatarProps) {
	const dimension = size;
	const radius = dimension / 2;

	if (uri) {
		return (
			<Image
				source={{ uri }}
				style={{ width: dimension, height: dimension, borderRadius: radius }}
				resizeMode="cover"
			/>
		);
	}

	return (
		<View
			style={{
				width: dimension,
				height: dimension,
				borderRadius: radius,
				backgroundColor,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Ionicons name="person" size={Math.round(dimension * 0.55)} color={iconColor} />
		</View>
	);
}
