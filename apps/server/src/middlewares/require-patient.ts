import type { MiddlewareHandler } from "hono";
import { getCookie, deleteCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { verifyPatientSession } from "../lib/patient-session";
import type { AppEnv } from "../types/context";

export const requirePatient: MiddlewareHandler<AppEnv> = async (c, next) => {
	const token = getCookie(c, "patient_session");
	if (!token) {
		throw new HTTPException(401, {
			message: "UNAUTHENTICATED",
		});
	}

	const session = await verifyPatientSession(token);
	if (!session || session.expiresAt.getTime() < Date.now()) {
		deleteCookie(c, "patient_session", {
			path: "/",
		});
		throw new HTTPException(401, {
			message: "UNAUTHENTICATED",
		});
	}

	c.set("patient", {
		id: session.patientId,
		expiresAt: session.expiresAt,
	});

	await next();
};
