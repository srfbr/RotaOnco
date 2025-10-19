import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { db } from "../src/db";
import { roles, userRoles, users } from "../src/db/schema/core";
import { user as authUsers } from "../src/db/schema/auth";

function usage() {
	console.error("Usage: bun run scripts/grant-role.ts <email> [role]");
	console.error("Example: bun run scripts/grant-role.ts admin@rotaonco.local professional");
}

function generateDocumentId() {
	return Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
}

async function main() {
	const [, , email, roleName = "professional"] = process.argv;

	if (!email) {
		usage();
		process.exit(1);
	}

	const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
	if (!authUser) {
		console.error(`No auth user found with email ${email}`);
		process.exit(1);
	}

	const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
	if (!role) {
		console.error(`Role ${roleName} not found. Create it first in the roles table.`);
		process.exit(1);
	}

	let [coreUser] = await db
		.select()
		.from(users)
		.where(eq(users.externalId, authUser.id))
		.limit(1);

	if (!coreUser) {
		const now = new Date();
		const documentId = generateDocumentId();

		await db
			.insert(users)
			.values({
				externalId: authUser.id,
				name: authUser.name,
				email: authUser.email,
				documentId,
				specialty: null,
				phone: null,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			})
			.onDuplicateKeyUpdate({
				set: {
					name: sql`VALUES(name)`,
					email: sql`VALUES(email)`,
					updatedAt: sql`VALUES(updated_at)`,
				},
			});

		[coreUser] = await db
			.select()
			.from(users)
			.where(eq(users.externalId, authUser.id))
			.limit(1);

		if (!coreUser) {
			console.error("Failed to create application user record");
			process.exit(1);
		}

		console.info(`Created application user ${coreUser.name} (${coreUser.id}) with document ${documentId}`);
	}

	await db
		.insert(userRoles)
		.values({
			userId: coreUser.id,
			roleId: role.id,
		})
		.onDuplicateKeyUpdate({
			set: {
				assignedAt: sql`VALUES(assigned_at)`,
			},
		});

	console.info(`Granted role ${roleName} to ${email}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
