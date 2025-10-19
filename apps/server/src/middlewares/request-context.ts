import type { MiddlewareHandler } from "hono";
import { createLogger } from "../lib/logger";
import type { AppEnv } from "../types/context";

export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
	const existingId = c.req.header("x-request-id");
	const requestId = existingId && existingId.length > 0 ? existingId : crypto.randomUUID();
	const logger = createLogger(requestId);

	c.set("requestId", requestId);
	c.set("logger", logger);

	await next();
};
