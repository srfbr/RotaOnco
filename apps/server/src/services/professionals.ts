import { and, eq, inArray, like, ne, or, sql, type SQL, type InferSelectModel } from "drizzle-orm";

import { db } from "../db";
import { appointments, occurrences, roles, userRoles, users } from "../db/schema/core";
import { auth } from "../lib/auth";

export type ProfessionalOnboardingInput = {
	externalId: string;
	fullName: string;
	email: string;
	documentId: string;
	specialty: string;
	phone?: string | null;
};

export type ProfessionalOnboardingResult = {
	userId: number;
	isNewUser: boolean;
	roles: string[];
};

export type ProfessionalCreateInput = {
	name: string;
	email: string;
	documentId: string;
	roles: Array<typeof PROFESSIONAL_ROLE_NAME | typeof ADMIN_ROLE_NAME>;
	specialty?: string | null;
	phone?: string | null;
};

export class ProfessionalOnboardingError extends Error {
	constructor(public code: "INVALID_DOCUMENT" | "DOCUMENT_IN_USE" | "ROLE_NOT_FOUND" | "MISSING_ACCOUNT" ) {
		super(code);
		this.name = "ProfessionalOnboardingError";
	}
}

export class ProfessionalInviteError extends Error {
	constructor(
		public code:
			| "INVALID_DOCUMENT"
			| "EMAIL_IN_USE"
			| "DOCUMENT_IN_USE"
			| "ROLE_NOT_FOUND"
	) {
		super(code);
		this.name = "ProfessionalInviteError";
	}
}

export type ProfessionalProfileUpdateInput = {
	userId: number;
	name?: string;
	specialty?: string | null;
	phone?: string | null;
	avatarDataUrl?: string | null;
};

export type ProfessionalProfileResult = {
	id: number;
	name: string;
	email: string;
	documentId: string;
	specialty: string | null;
	phone: string | null;
	avatarUrl: string | null;
	isActive: boolean;
	roles: string[];
	createdAt: string | null;
	updatedAt: string | null;
	mustChangePassword: boolean;
};

export class ProfessionalProfileUpdateError extends Error {
	constructor(public code: "NOT_FOUND" | "INVALID_AVATAR") {
		super(code);
		this.name = "ProfessionalProfileUpdateError";
	}
}

export class ProfessionalDeleteError extends Error {
	constructor(public code: "NOT_FOUND" | "HAS_DEPENDENCIES") {
		super(code);
		this.name = "ProfessionalDeleteError";
	}
}

const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_AVATAR_BYTES = 1_000_000; // ~1MB after base64 decoding
const AVATAR_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/;

function sanitizeAvatarDataUrl(value?: string | null) {
	if (value === undefined) {
		return undefined;
	}
	if (value === null) {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	if (trimmed.length > 2_000_000) {
		throw new ProfessionalProfileUpdateError("INVALID_AVATAR");
	}
	if (!AVATAR_DATA_URL_REGEX.test(trimmed)) {
		throw new ProfessionalProfileUpdateError("INVALID_AVATAR");
	}
	const [meta, base64] = trimmed.split(",");
	if (!meta || !base64) {
		throw new ProfessionalProfileUpdateError("INVALID_AVATAR");
	}
	const mime = meta.split(";")[0]?.split(":")[1];
	if (!mime || !ALLOWED_AVATAR_MIME_TYPES.has(mime)) {
		throw new ProfessionalProfileUpdateError("INVALID_AVATAR");
	}
	const estimatedBytes = Math.floor(base64.length * 0.75);
	if (estimatedBytes > MAX_AVATAR_BYTES) {
		throw new ProfessionalProfileUpdateError("INVALID_AVATAR");
	}
	return trimmed;
}

function sanitizeDocumentId(doc: string) {
	return doc.replace(/\D/g, "");
}

function sanitizePhone(phone?: string | null) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, "");
	return digits.length === 0 ? null : digits;
}

function normalizeOptionalString(value?: string | null) {
	if (value === undefined || value === null) {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function clampLimit(limit?: number) {
	if (limit === undefined || limit === null) {
		return DEFAULT_LIST_LIMIT;
	}
	return Math.max(1, Math.min(limit, MAX_LIST_LIMIT));
}

function normalizeOffset(offset?: number) {
	if (offset === undefined || offset === null) {
		return 0;
	}
	return Math.max(0, offset);
}

function toIsoString(value: Date | string | null | undefined) {
	if (!value) {
		return null;
	}
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface ProfessionalOnboardingService {
	createProfessional(input: ProfessionalCreateInput): Promise<ProfessionalProfileResult>;
	completeOnboarding(input: ProfessionalOnboardingInput): Promise<ProfessionalOnboardingResult>;
	updateProfile(input: ProfessionalProfileUpdateInput): Promise<ProfessionalProfileResult>;
	updatePassword(input: ProfessionalPasswordUpdateInput): Promise<void>;
	deleteProfessional(userId: number): Promise<void>;
}

export type ProfessionalPasswordUpdateInput = {
	userId: number;
	externalId: string;
	newPassword: string;
};

export function createProfessionalDirectoryService(): ProfessionalDirectoryService {
	return {
		async listProfessionals(params) {
			const limit = clampLimit(params.limit);
			const offset = normalizeOffset(params.offset);
			const search = params.q?.trim();
			const statusFilter = params.status;
			let whereClause: SQL<unknown> = eq(roles.name, PROFESSIONAL_ROLE_NAME);
			if (statusFilter) {
				const isActive = statusFilter === "active";
				whereClause = and(whereClause, eq(users.isActive, isActive)) as SQL<unknown>;
			}
			if (search && search.length > 0) {
				const normalizedSearch = search.replace(/\s+/g, "%");
				const pattern = `%${normalizedSearch}%`;
				whereClause = and(
					whereClause,
					or(
						like(users.name, pattern),
						like(users.email, pattern),
						like(users.specialty, pattern),
						like(users.documentId, pattern),
					),
				) as SQL<unknown>;
			}

			const rows = await db
				.select({
					id: users.id,
					name: users.name,
					email: users.email,
					documentId: users.documentId,
					specialty: users.specialty,
					phone: users.phone,
					avatarUrl: users.avatarUrl,
					isActive: users.isActive,
					mustChangePassword: users.mustChangePassword,
					createdAt: users.createdAt,
					updatedAt: users.updatedAt,
				})
				.from(users)
				.innerJoin(userRoles, eq(userRoles.userId, users.id))
				.innerJoin(roles, eq(roles.id, userRoles.roleId))
				.where(whereClause)
				.groupBy(
					users.id,
					users.name,
					users.email,
					users.documentId,
					users.specialty,
					users.phone,
					users.avatarUrl,
					users.isActive,
					users.mustChangePassword,
					users.createdAt,
					users.updatedAt,
				)
				.orderBy(users.name)
				.limit(limit)
				.offset(offset);

			let countQuery = db
				.select({ count: sql<number>`COUNT(DISTINCT ${users.id})` })
				.from(users)
				.innerJoin(userRoles, eq(userRoles.userId, users.id))
				.innerJoin(roles, eq(roles.id, userRoles.roleId))
				.where(whereClause);
			const [{ count: totalCount = 0 } = { count: 0 }] = await countQuery;

			const userIds = rows.map((row) => row.id);
			let roleRows: Array<{ userId: number; role: string }> = [];
			if (userIds.length > 0) {
				roleRows = await db
					.select({
						userId: userRoles.userId,
						role: roles.name,
					})
					.from(userRoles)
					.innerJoin(roles, eq(roles.id, userRoles.roleId))
					.where(inArray(userRoles.userId, userIds));
			}

			const rolesMap = new Map<number, string[]>();
			for (const row of roleRows) {
				const current = rolesMap.get(row.userId) ?? [];
				current.push(row.role);
				rolesMap.set(row.userId, current);
			}

			const data = rows.map((row) => ({
				id: row.id,
				name: row.name,
				email: row.email,
				documentId: row.documentId,
				specialty: row.specialty ?? null,
				phone: row.phone ?? null,
				avatarUrl: row.avatarUrl ?? null,
				isActive: Boolean(row.isActive),
				mustChangePassword: Boolean(row.mustChangePassword),
				roles: rolesMap.get(row.id) ?? [],
				createdAt: toIsoString(row.createdAt),
				updatedAt: toIsoString(row.updatedAt),
			}));

			return {
				data,
				total: Number(totalCount) || 0,
				limit,
				offset,
			};
		},
		async getSummary() {
			const [active, inactive] = await Promise.all([
				countProfessionalsByStatus(true),
				countProfessionalsByStatus(false),
			]);
			return {
				total: active + inactive,
				active,
				inactive,
			};
		},
	};
}

async function countProfessionalsByStatus(isActive: boolean) {
	const [{ count = 0 } = { count: 0 }] = await db
		.select({ count: sql<number>`COUNT(DISTINCT ${users.id})` })
		.from(users)
		.innerJoin(userRoles, eq(userRoles.userId, users.id))
		.innerJoin(roles, eq(roles.id, userRoles.roleId))
		.where(and(eq(roles.name, PROFESSIONAL_ROLE_NAME), eq(users.isActive, isActive)));
	return Number(count) || 0;
}

const PROFESSIONAL_ROLE_NAME = "professional" as const;
const ADMIN_ROLE_NAME = "admin" as const;
const DEFAULT_INITIAL_PASSWORD = "rotaonco2025" as const;
const EMAIL_PASSWORD_PROVIDER_ID = "email-password" as const;
const KNOWN_EMAIL_PASSWORD_PROVIDERS = new Set([
	EMAIL_PASSWORD_PROVIDER_ID,
	"email",
	"password",
]);

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export type ProfessionalListParams = {
	q?: string;
	status?: "active" | "inactive";
	limit?: number;
	offset?: number;
};

export type ProfessionalDirectoryResult = {
	data: Array<{
		id: number;
		name: string;
		email: string;
		documentId: string;
		specialty?: string | null;
		phone?: string | null;
		avatarUrl?: string | null;
		isActive: boolean;
		mustChangePassword: boolean;
		roles: string[];
		createdAt?: string | null;
		updatedAt?: string | null;
	}>;
	total: number;
	limit: number;
	offset: number;
};

export type ProfessionalStatusSummary = {
	total: number;
	active: number;
	inactive: number;
};

export interface ProfessionalDirectoryService {
	listProfessionals(params: ProfessionalListParams): Promise<ProfessionalDirectoryResult>;
	getSummary(): Promise<ProfessionalStatusSummary>;
}

export function createProfessionalOnboardingService(): ProfessionalOnboardingService {
	return {
		async createProfessional(input) {
			const documentDigits = sanitizeDocumentId(input.documentId);
			if (documentDigits.length !== 11) {
				throw new ProfessionalInviteError("INVALID_DOCUMENT");
			}

			const normalizedName = input.name.trim();
			const normalizedEmail = input.email.trim().toLowerCase();
			const normalizedSpecialty = normalizeOptionalString(input.specialty);
			const normalizedPhone = sanitizePhone(normalizeOptionalString(input.phone));

			const requestedRoles = Array.from(new Set([...input.roles, PROFESSIONAL_ROLE_NAME]));
			const allowedRoles = new Set([PROFESSIONAL_ROLE_NAME, ADMIN_ROLE_NAME]);
			if (requestedRoles.some((role) => !allowedRoles.has(role))) {
				throw new ProfessionalInviteError("ROLE_NOT_FOUND");
			}
			const rolesToAssign = requestedRoles as Array<typeof PROFESSIONAL_ROLE_NAME | typeof ADMIN_ROLE_NAME>;

			const [existingDocumentOwner, existingEmailOwner] = await Promise.all([
				db.query.users.findFirst({
					where: eq(users.documentId, documentDigits),
				}),
				db.query.users.findFirst({
					where: eq(users.email, normalizedEmail),
				}),
			]);

			const ctx = await auth.$context;
			const internalAdapter = ctx.internalAdapter;
			const existingAuthUser = await internalAdapter.findUserByEmail(normalizedEmail, {
				includeAccounts: true,
			});

			if (!existingAuthUser && existingEmailOwner) {
				throw new ProfessionalInviteError("EMAIL_IN_USE");
			}
			if (!existingAuthUser && existingDocumentOwner) {
				throw new ProfessionalInviteError("DOCUMENT_IN_USE");
			}

			let authUserId: string;
			let createdAuthUser = false;
			let passwordAccount = existingAuthUser?.accounts?.find((account) =>
				KNOWN_EMAIL_PASSWORD_PROVIDERS.has(account.providerId),
			);
			let createdPasswordAccount = false;

			if (existingAuthUser?.user) {
				authUserId = existingAuthUser.user.id;
				if (existingAuthUser.user.name !== normalizedName) {
					await internalAdapter.updateUser(authUserId, { name: normalizedName });
				}
			} else {
				const created = await internalAdapter.createUser({
					email: normalizedEmail,
					name: normalizedName,
					emailVerified: false,
				});
				authUserId = created.id;
				createdAuthUser = true;
			}

			if (existingDocumentOwner && existingDocumentOwner.externalId !== authUserId) {
				if (createdAuthUser) {
					await internalAdapter.deleteUser(authUserId).catch(() => {});
				}
				throw new ProfessionalInviteError("DOCUMENT_IN_USE");
			}

			if (existingEmailOwner && existingEmailOwner.externalId !== authUserId) {
				if (createdAuthUser) {
					await internalAdapter.deleteUser(authUserId).catch(() => {});
				}
				throw new ProfessionalInviteError("EMAIL_IN_USE");
			}

			try {
				if (!passwordAccount) {
					passwordAccount = await internalAdapter.createAccount({
						userId: authUserId,
						providerId: EMAIL_PASSWORD_PROVIDER_ID,
						accountId: normalizedEmail,
					});
					createdPasswordAccount = true;
				} else if (passwordAccount.accountId !== normalizedEmail) {
					await internalAdapter.updateAccount(passwordAccount.id, {
						accountId: normalizedEmail,
					});
				}

				const needsPasswordReset = createdAuthUser || createdPasswordAccount;

				if (needsPasswordReset) {
					await internalAdapter.updatePassword(authUserId, DEFAULT_INITIAL_PASSWORD);
				}

				return await db.transaction(async (tx) => {
					let applicationUser = await tx.query.users.findFirst({
						where: eq(users.externalId, authUserId),
					});

					const now = new Date();
					const requirePasswordChange = needsPasswordReset;

					if (applicationUser) {
						const updatePayload: Partial<typeof users.$inferInsert> = {
							name: normalizedName,
							email: normalizedEmail,
							documentId: documentDigits,
							specialty: normalizedSpecialty,
							phone: normalizedPhone,
							isActive: true,
							updatedAt: now,
						};
						if (requirePasswordChange) {
							updatePayload.mustChangePassword = true;
						}
						await tx
							.update(users)
							.set(updatePayload)
							.where(eq(users.id, applicationUser.id));
					} else {
						await tx.insert(users).values({
							externalId: authUserId,
							name: normalizedName,
							email: normalizedEmail,
							documentId: documentDigits,
							specialty: normalizedSpecialty,
							phone: normalizedPhone,
							isActive: true,
							mustChangePassword: requirePasswordChange,
							createdAt: now,
							updatedAt: now,
						});
					}

					applicationUser = await tx.query.users.findFirst({
						where: eq(users.externalId, authUserId),
					});

					if (!applicationUser) {
						throw new ProfessionalInviteError("EMAIL_IN_USE");
					}

					const userId = applicationUser.id;

					const roleRows = await tx
						.select({ id: roles.id, name: roles.name })
						.from(roles)
						.where(inArray(roles.name, rolesToAssign));

					if (roleRows.length !== rolesToAssign.length) {
						throw new ProfessionalInviteError("ROLE_NOT_FOUND");
					}

					await tx.delete(userRoles).where(eq(userRoles.userId, userId));

					if (roleRows.length > 0) {
						await tx
							.insert(userRoles)
							.values(roleRows.map((role) => ({ userId, roleId: role.id })))
							.onDuplicateKeyUpdate({
								set: {
									assignedAt: sql`VALUES(assigned_at)`,
								},
							});
					}

					const roleNames = roleRows.map((role) => role.name);
					return buildProfessionalProfile(applicationUser, roleNames);
				});
			} catch (error) {
				if (createdPasswordAccount && passwordAccount) {
					await internalAdapter.deleteAccount(passwordAccount.id).catch(() => {});
				}
				if (createdAuthUser) {
					await internalAdapter.deleteUser(authUserId).catch(() => {});
				}
				throw error;
			}
		},
		async completeOnboarding(input) {
			const documentDigits = sanitizeDocumentId(input.documentId);
			if (documentDigits.length !== 11) {
				throw new ProfessionalOnboardingError("INVALID_DOCUMENT");
			}

			const normalizedName = input.fullName.trim();
			const normalizedEmail = input.email.trim().toLowerCase();
			const normalizedSpecialty = input.specialty.trim();
			const normalizedPhone = sanitizePhone(input.phone);

			if (!normalizedName) {
				throw new ProfessionalOnboardingError("MISSING_ACCOUNT");
			}

			return db.transaction(async (tx) => {
				const existingUser = await tx.query.users.findFirst({
					where: eq(users.externalId, input.externalId),
				});

				if (existingUser && existingUser.documentId !== documentDigits) {
					const conflictingDocumentOwner = await tx.query.users.findFirst({
						where: and(eq(users.documentId, documentDigits), ne(users.id, existingUser.id)),
					});
					if (conflictingDocumentOwner) {
						throw new ProfessionalOnboardingError("DOCUMENT_IN_USE");
					}
				}

				if (!existingUser) {
					const conflictingDocumentOwner = await tx.query.users.findFirst({
						where: eq(users.documentId, documentDigits),
					});
					if (conflictingDocumentOwner) {
						throw new ProfessionalOnboardingError("DOCUMENT_IN_USE");
					}
				}

				let userId: number;
				let isNewUser = false;

				if (existingUser) {
					await tx
						.update(users)
						.set({
							name: normalizedName,
							email: normalizedEmail,
							documentId: documentDigits,
							specialty: normalizedSpecialty,
							phone: normalizedPhone,
							updatedAt: new Date(),
						})
						.where(eq(users.id, existingUser.id));
					userId = existingUser.id;
				} else {
					const insertResult = await tx.insert(users).values({
						externalId: input.externalId,
						name: normalizedName,
						email: normalizedEmail,
						documentId: documentDigits,
						specialty: normalizedSpecialty,
						phone: normalizedPhone,
						isActive: true,
					});

					const insertedId = Number((insertResult as { insertId?: number }).insertId);
					if (!insertedId || Number.isNaN(insertedId)) {
						const createdUser = await tx.query.users.findFirst({
							where: eq(users.externalId, input.externalId),
						});
						if (!createdUser) {
							throw new ProfessionalOnboardingError("MISSING_ACCOUNT");
						}
						userId = createdUser.id;
					} else {
						userId = insertedId;
					}
					isNewUser = true;
				}

				const [professionalRole] = await tx.select().from(roles).where(eq(roles.name, PROFESSIONAL_ROLE_NAME)).limit(1);
				if (!professionalRole) {
					throw new ProfessionalOnboardingError("ROLE_NOT_FOUND");
				}

				await tx
					.insert(userRoles)
					.values({
						userId,
						roleId: professionalRole.id,
					})
					.onDuplicateKeyUpdate({
						set: {
							assignedAt: sql`VALUES(assigned_at)`,
						},
					});

				const roleRows = await tx
					.select({ name: roles.name })
					.from(userRoles)
					.innerJoin(roles, eq(roles.id, userRoles.roleId))
					.where(eq(userRoles.userId, userId));

				return {
					userId,
					isNewUser,
					roles: roleRows.map((row) => row.name),
				};
			});
		},
		async updateProfile(input) {
			return db.transaction(async (tx) => {
				const existing = await tx.query.users.findFirst({
					where: eq(users.id, input.userId),
				});

				if (!existing) {
					throw new ProfessionalProfileUpdateError("NOT_FOUND");
				}

				let hasChanges = false;
				const updates: {
					name?: string;
					specialty?: string | null;
					phone?: string | null;
					avatarUrl?: string | null;
					updatedAt?: Date;
				} = {};

				if (input.name !== undefined) {
					const normalizedName = input.name.trim();
					if (normalizedName !== existing.name) {
						updates.name = normalizedName;
						hasChanges = true;
					}
				}

				if (input.specialty !== undefined) {
					const trimmedSpecialty =
						input.specialty === null ? null : input.specialty.trim();
					const normalizedSpecialty =
						trimmedSpecialty && trimmedSpecialty.length > 0 ? trimmedSpecialty : null;
					if ((existing.specialty ?? null) !== (normalizedSpecialty ?? null)) {
						updates.specialty = normalizedSpecialty;
						hasChanges = true;
					}
				}

				if (input.phone !== undefined) {
					const sanitizedPhone = sanitizePhone(input.phone);
					if ((existing.phone ?? null) !== (sanitizedPhone ?? null)) {
						updates.phone = sanitizedPhone;
						hasChanges = true;
					}
				}

				const sanitizedAvatar = sanitizeAvatarDataUrl(input.avatarDataUrl);
				if (sanitizedAvatar !== undefined) {
					if ((existing.avatarUrl ?? null) !== (sanitizedAvatar ?? null)) {
						updates.avatarUrl = sanitizedAvatar;
						hasChanges = true;
					}
				}

				let profileSource = existing;

				if (hasChanges) {
					updates.updatedAt = new Date();
					await tx
						.update(users)
						.set(updates)
						.where(eq(users.id, input.userId));

					const refreshed = await tx.query.users.findFirst({
						where: eq(users.id, input.userId),
					});
					if (!refreshed) {
						throw new ProfessionalProfileUpdateError("NOT_FOUND");
					}
					profileSource = refreshed;
				}

				const roleRows = await tx
					.select({ role: roles.name })
					.from(userRoles)
					.innerJoin(roles, eq(roles.id, userRoles.roleId))
					.where(eq(userRoles.userId, input.userId));
				const roleNames = roleRows.map((row) => row.role);

				return {
					id: profileSource.id,
					name: profileSource.name,
					email: profileSource.email,
					documentId: profileSource.documentId,
					specialty: profileSource.specialty ?? null,
					phone: profileSource.phone ?? null,
					avatarUrl: profileSource.avatarUrl ?? null,
					isActive: Boolean(profileSource.isActive),
					roles: roleNames,
					createdAt: toIsoString(profileSource.createdAt),
					updatedAt: toIsoString(profileSource.updatedAt),
					mustChangePassword: Boolean(profileSource.mustChangePassword),
				};
			});
		},
		async updatePassword(input) {
			const ctx = await auth.$context;
			await ctx.internalAdapter.updatePassword(input.externalId, input.newPassword);
			await db
				.update(users)
				.set({
					mustChangePassword: false,
					updatedAt: new Date(),
				})
				.where(eq(users.id, input.userId));
		},
		async deleteProfessional(userId) {
			const existing = await db.query.users.findFirst({
				where: eq(users.id, userId),
			});

			if (!existing) {
				throw new ProfessionalDeleteError("NOT_FOUND");
			}

			const [hasAppointments] = await db
				.select({ id: appointments.id })
				.from(appointments)
				.where(eq(appointments.professionalId, userId))
				.limit(1);
			if (hasAppointments) {
				throw new ProfessionalDeleteError("HAS_DEPENDENCIES");
			}

			const [hasOccurrences] = await db
				.select({ id: occurrences.id })
				.from(occurrences)
				.where(eq(occurrences.professionalId, userId))
				.limit(1);
			if (hasOccurrences) {
				throw new ProfessionalDeleteError("HAS_DEPENDENCIES");
			}

			try {
				await db.transaction(async (tx) => {
					await tx.delete(userRoles).where(eq(userRoles.userId, userId));
					await tx.delete(users).where(eq(users.id, userId));
				});
			} catch (error) {
				if (isForeignKeyConstraintError(error)) {
					throw new ProfessionalDeleteError("HAS_DEPENDENCIES");
				}
				throw error;
			}

			const ctx = await auth.$context;
			await ctx.internalAdapter.deleteUser(existing.externalId).catch((error) => {
				if (!isRecordNotFoundError(error)) {
					throw error;
				}
			});
		},
	};
}

type UserRecord = InferSelectModel<typeof users>;

function buildProfessionalProfile(user: UserRecord, roleNames: string[]): ProfessionalProfileResult {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		documentId: user.documentId,
		specialty: user.specialty ?? null,
		phone: user.phone ?? null,
		avatarUrl: user.avatarUrl ?? null,
		isActive: Boolean(user.isActive),
		roles: roleNames,
		createdAt: toIsoString(user.createdAt),
		updatedAt: toIsoString(user.updatedAt),
		mustChangePassword: Boolean(user.mustChangePassword),
	};
}

function isForeignKeyConstraintError(error: unknown) {
	if (!error || typeof error !== "object") {
		return false;
	}
	const maybe = error as { code?: string };
	return maybe.code === "ER_ROW_IS_REFERENCED_2" || maybe.code === "ER_ROW_IS_REFERENCED";
}

function isRecordNotFoundError(error: unknown) {
	if (!(error instanceof Error) || !error.message) {
		return false;
	}
	const normalized = error.message.toLowerCase();
	return normalized.includes("not found") || normalized.includes("does not exist");
}
