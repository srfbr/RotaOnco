import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import * as authSchema from "./schema/auth";
import * as coreSchema from "./schema/core";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const pool = createPool({
	uri: DATABASE_URL,
});

export const db = drizzle(pool, {
	mode: "default",
	schema: {
		...authSchema,
		...coreSchema,
	},
});
