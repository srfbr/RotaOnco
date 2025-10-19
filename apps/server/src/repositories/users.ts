import { eq } from "drizzle-orm";
import { db } from "../db";
import { roles, userRoles, users } from "../db/schema/core";

export type UserWithRoles = {
	id: number;
	externalId: string;
	roles: string[];
};

export async function findUserWithRolesByExternalId(externalId: string): Promise<UserWithRoles | null> {
	const rows = await db
		.select({
			id: users.id,
			externalId: users.externalId,
			role: roles.name,
		})
		.from(users)
		.leftJoin(userRoles, eq(userRoles.userId, users.id))
		.leftJoin(roles, eq(roles.id, userRoles.roleId))
		.where(eq(users.externalId, externalId));

	if (rows.length === 0) {
		return null;
	}

	const { id } = rows[0];
	const roleNames = Array.from(new Set(rows.map((row) => row.role).filter((name): name is string => Boolean(name))));

	return {
		id,
		externalId,
		roles: roleNames,
	};
}
