import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

export type Session = (typeof authClient)["$Infer"]["Session"];

type UseSessionReturn = ReturnType<typeof authClient.useSession>;

type AuthSessionContextValue = {
	session: Session | null;
	error: UseSessionReturn["error"];
	isLoading: boolean;
	isAuthenticated: boolean;
	status: "loading" | "authenticated" | "unauthenticated";
	refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(
	undefined,
);

export function AuthSessionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const sessionState = authClient.useSession();

	const contextValue = useMemo<AuthSessionContextValue>(() => {
		const isAuthenticated = Boolean(sessionState.data);

		return {
			session: sessionState.data ?? null,
			error: sessionState.error,
			isLoading: sessionState.isPending,
			isAuthenticated,
			status: sessionState.isPending
				? "loading"
				: isAuthenticated
					? "authenticated"
					: "unauthenticated",
			refresh: async () => {
				await authClient.getSession();
				authClient.$store.notify("$sessionSignal");
			},
		};
	}, [sessionState.data, sessionState.error, sessionState.isPending]);

	if (sessionState.isPending) {
		return <Loader />;
	}

	return (
		<AuthSessionContext.Provider value={contextValue}>
			{children}
		</AuthSessionContext.Provider>
	);
}

export function useAuthSession() {
	const context = useContext(AuthSessionContext);

	if (!context) {
		throw new Error("useAuthSession must be used within an AuthSessionProvider");
	}

	return context;
}
