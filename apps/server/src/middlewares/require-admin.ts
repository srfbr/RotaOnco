import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import { auth } from "../lib/auth";
import { findUserWithRolesByExternalId } from "../repositories/users";
import type { AppEnv } from "../types/context";

const ADMIN_ROLES = new Set(["admin"]);

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
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

	const hasAdminRole = professional.roles.some((role) => ADMIN_ROLES.has(role));
	if (!hasAdminRole) {
		throw new HTTPException(403, { message: "FORBIDDEN" });
	}

	c.set("professional", professional);

	await next();
};
