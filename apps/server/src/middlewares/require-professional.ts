import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../lib/auth";
import { findUserWithRolesByExternalId } from "../repositories/users";
import type { AppEnv } from "../types/context";

const PROFESSIONAL_ROLES = new Set(["admin", "professional"]);

export const requireProfessional: MiddlewareHandler<AppEnv> = async (c, next) => {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		throw new HTTPException(401, { message: "UNAUTHENTICATED" });
	}

	const professional = await findUserWithRolesByExternalId(session.user.id);

	if (!professional) {
		throw new HTTPException(403, { message: "FORBIDDEN" });
	}

	const hasAllowedRole = professional.roles.some((role) => PROFESSIONAL_ROLES.has(role));
	if (!hasAllowedRole) {
		throw new HTTPException(403, { message: "FORBIDDEN" });
	}

	c.set("professional", professional);

	await next();
};
