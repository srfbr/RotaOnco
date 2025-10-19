import Loader from "@/components/loader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/providers/auth-session-provider";
import type { ApiClient } from "@/lib/api-client";
import type { AuthClient } from "@/lib/auth-client";
import type { QueryClient } from "@tanstack/react-query";
import {
	HeadContent,
	Outlet,
	createRootRouteWithContext,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "../index.css";

export interface RouterAppContext {
	authClient: AuthClient;
	queryClient: QueryClient;
	apiClient: ApiClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "rotaonco",
			},
			{
				name: "description",
				content: "rotaonco is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	const isFetching = useRouterState({
		select: (s) => s.isLoading,
	});

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<AuthSessionProvider>
					<div className="relative min-h-svh bg-background">
						<Outlet />
						{isFetching && (
							<div className="absolute inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
								<Loader />
							</div>
						)}
					</div>
					<Toaster richColors />
				</AuthSessionProvider>
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			{import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-right" />}
		</>
	);
}
