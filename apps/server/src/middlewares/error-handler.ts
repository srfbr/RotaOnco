import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../types/context";

function toErrorResponse(error: unknown) {
	if (error instanceof HTTPException) {
		return {
			status: error.status,
			body: error.res ? undefined : { code: "HTTP_EXCEPTION", message: error.message },
		};
	}
	if (error instanceof Error) {
		return {
			status: 500,
			body: { code: "INTERNAL_ERROR", message: error.message },
		};
	}
	return {
		status: 500,
		body: { code: "INTERNAL_ERROR", message: "Unexpected error" },
	};
}

export const errorHandler: MiddlewareHandler<AppEnv> = async (c, next) => {
	try {
		await next();
	} catch (err) {
		const logger = c.get("logger");
		logger.error("Unhandled error", err instanceof Error ? { message: err.message } : {});
		const { status, body } = toErrorResponse(err);
		if (body) {
			const statusCode = status as StatusCode;
			c.status(statusCode);
			return c.json(body);
		}
		if (err instanceof HTTPException) {
			return err.getResponse();
		}
		const statusCode = status as StatusCode;
		c.status(statusCode);
		return c.json({ code: "INTERNAL_ERROR", message: "Unexpected error" });
	}
};
