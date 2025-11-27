import { TabBarIcon } from "@/components/tabbar-icon";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Tabs } from "expo-router";

export default function TabLayout() {
	const { isDarkColorScheme } = useColorScheme();

	return (
		<Tabs
			initialRouteName="index"
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: isDarkColorScheme ? "#98C2FF" : "#2F66F5",
				tabBarInactiveTintColor: isDarkColorScheme ? "#8A94A6" : "#9CA3AF",
				tabBarStyle: {
					height: 72,
					paddingHorizontal: 32,
					paddingTop: 12,
					paddingBottom: 16,
					backgroundColor: isDarkColorScheme ? "#111827" : "#FFFFFF",
					borderTopWidth: 1,
					borderTopColor: isDarkColorScheme ? "#1F2937" : "#E5E7EB",
				},
				tabBarIconStyle: {
					marginTop: 4,
				},
				tabBarHideOnKeyboard: true,
				tabBarShowLabel: false,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Início",
					tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
				}}
			/>
			<Tabs.Screen
				name="appointments"
				options={{
					title: "Consultas",
					tabBarIcon: ({ color }) => <TabBarIcon name="calendar-check-o" color={color} />,
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Perfil",
					tabBarIcon: ({ color }) => <TabBarIcon name="question-circle" color={color} />,
				}}
			/>
		</Tabs>
	);
}
