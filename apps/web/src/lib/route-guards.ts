import { redirect } from "@tanstack/react-router";
import type { RouterAppContext } from "@/routes/__root";
import type { components } from "@/lib/api-schema";

const LOGIN_ROUTE = "/login" as const;
const DASHBOARD_ROUTE = "/dashboard" as const;
const PASSWORD_ROUTE = "/nova-senha" as const;

type Professional = components["schemas"]["User"];

type FetchProfessionalResult = Professional;

type FetchContext = RouterAppContext;

function getErrorStatus(error: unknown): number | null {
	if (!error || typeof error !== "object") {
		return null;
	}
	const payload = error as { status?: unknown; error?: unknown };
	if (typeof payload.status === "number") {
		return payload.status;
	}
	return getErrorStatus(payload.error);
}

async function resolveCurrentProfessional(context: FetchContext): Promise<FetchProfessionalResult> {
	const session = await context.authClient.getSession();
	if (!session.data || session.error) {
		throw redirect({ to: LOGIN_ROUTE });
	}

	const { data, error } = await context.apiClient.GET("/professionals/me");
	if (error) {
		const status = getErrorStatus(error);
		if (status === 401 || status === 403) {
			throw redirect({ to: LOGIN_ROUTE });
		}
		throw error;
	}

	if (!data) {
		throw redirect({ to: LOGIN_ROUTE });
	}

	return data;
}

export async function requireActiveProfessional(context: FetchContext): Promise<FetchProfessionalResult> {
	const professional = await resolveCurrentProfessional(context);

	if (professional.mustChangePassword) {
		throw redirect({ to: PASSWORD_ROUTE });
	}

	return professional;
}

export async function requirePasswordChangeProfessional(context: FetchContext): Promise<FetchProfessionalResult> {
	const professional = await resolveCurrentProfessional(context);

	if (!professional.mustChangePassword) {
		throw redirect({ to: DASHBOARD_ROUTE });
	}

	return professional;
}
