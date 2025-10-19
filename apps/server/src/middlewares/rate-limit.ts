import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/context";

interface RateLimitOptions {
	windowMs: number;
	max: number;
	keyGenerator?: (context: Parameters<MiddlewareHandler<AppEnv>>[0]) => string;
}

type Bucket = {
	count: number;
	expiresAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
	const { windowMs, max, keyGenerator } = options;

	return async (c, next) => {
		const key = keyGenerator
			? keyGenerator(c)
			: `${c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || c.req.raw.headers.get("x-real-ip") || c.req.raw.headers.get("x-client-ip") || c.req.raw.headers.get("x-forwarded-for") || c.req.raw.headers.get("remote-addr") || c.req.raw.headers.get("forwarded") || "anonymous"}:${c.req.path}`;
		const now = Date.now();
		let bucket = buckets.get(key);

		if (!bucket || bucket.expiresAt < now) {
			bucket = { count: 0, expiresAt: now + windowMs };
			buckets.set(key, bucket);
		}

		if (bucket.count >= max) {
			const retryAfter = Math.ceil((bucket.expiresAt - now) / 1000);
			c.res.headers.set("Retry-After", retryAfter.toString());
			c.status(429);
			return c.json({ code: "RATE_LIMITED", message: "Too many requests" });
		}

		bucket.count += 1;
		await next();
		const remaining = Math.max(0, max - bucket.count);
		const reset = Math.ceil((bucket.expiresAt - Date.now()) / 1000);
		c.res.headers.set("RateLimit-Limit", max.toString());
		c.res.headers.set("RateLimit-Remaining", remaining.toString());
		c.res.headers.set("RateLimit-Reset", Math.max(reset, 0).toString());
	};
}
