import { TabBarIcon } from "@/components/tabbar-icon";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Tabs } from "expo-router";

const ProfessionalTabLayout = () => {
	const { isDarkColorScheme } = useColorScheme();

	return (
		<Tabs
			initialRouteName="index"
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: isDarkColorScheme ? "#93C5FD" : "#1D4ED8",
				tabBarInactiveTintColor: isDarkColorScheme ? "#64748B" : "#94A3B8",
				tabBarStyle: {
					height: 72,
					paddingHorizontal: 28,
					paddingTop: 12,
					paddingBottom: 16,
					backgroundColor: isDarkColorScheme ? "#0F172A" : "#FFFFFF",
					borderTopWidth: 1,
					borderTopColor: isDarkColorScheme ? "#1E293B" : "#E2E8F0",
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
					title: "Home",
					tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
				}}
			/>
			<Tabs.Screen
				name="workspace"
				options={{
					title: "Área do profissional",
					tabBarIcon: ({ color }) => <TabBarIcon name="stethoscope" color={color} />,
				}}
			/>
			<Tabs.Screen
				name="schedule"
				options={{
					title: "Gerenciar agenda",
					tabBarIcon: ({ color }) => <TabBarIcon name="calendar-check-o" color={color} />,
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Perfil",
					tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
				}}
			/>
		</Tabs>
	);
};

export default ProfessionalTabLayout;
