import {
	mysqlTable,
	bigint,
	int,
	varchar,
	boolean,
	datetime,
	mysqlEnum,
	text,
	char,
	tinyint,
	json,
	index,
	uniqueIndex,
	primaryKey,
	timestamp,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

import { user } from "./auth";

export const roles = mysqlTable("roles", {
	id: int("id").autoincrement().primaryKey(),
	name: varchar("name", { length: 64 }).notNull().unique(),
	description: varchar("description", { length: 191 }),
});

export const users = mysqlTable(
	"users",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		externalId: varchar("external_id", { length: 36 })
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 191 }).notNull(),
		email: varchar("email", { length: 191 }).notNull().unique(),
		documentId: varchar("document_id", { length: 32 }).notNull().unique(),
		specialty: varchar("specialty", { length: 191 }),
		phone: varchar("phone", { length: 32 }),
		avatarUrl: text("avatar_url"),
		isActive: boolean("is_active").notNull().default(true),
		mustChangePassword: boolean("must_change_password").notNull().default(false),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
		updatedAt: datetime("updated_at", { fsp: 3 })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		emailIdx: index("users_email_idx").on(table.email),
		documentIdx: index("users_document_idx").on(table.documentId),
	}),
);

export const userRoles = mysqlTable(
	"user_roles",
	{
		userId: bigint("user_id", { mode: "number" })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		roleId: int("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
		assignedAt: datetime("assigned_at", { fsp: 3 })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		pk: primaryKey({ name: "user_roles_pk", columns: [table.userId, table.roleId] }),
	}),
);

export const patients = mysqlTable(
	"patients",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		fullName: varchar("full_name", { length: 191 }).notNull(),
		cpf: char("cpf", { length: 11 }).notNull().unique(),
		birthDate: datetime("birth_date"),
		phone: varchar("phone", { length: 32 }),
		emergencyPhone: varchar("emergency_phone", { length: 32 }),
		tumorType: varchar("tumor_type", { length: 191 }),
		clinicalUnit: varchar("clinical_unit", { length: 191 }),
		stage: mysqlEnum("stage", ["pre_triage", "in_treatment", "post_treatment"]) // prettier-ignore
			.notNull()
			.default("pre_triage"),
		status: mysqlEnum("status", ["active", "inactive", "at_risk"]).notNull().default("active"),
		audioMaterialUrl: varchar("audio_material_url", { length: 255 }),
		pinAttempts: int("pin_attempts").notNull().default(0),
		pinBlockedUntil: datetime("pin_blocked_until", { fsp: 3 }),
		pinHash: varchar("pin_hash", { length: 191 }).notNull(),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
		updatedAt: datetime("updated_at", { fsp: 3 })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		cpfIdx: index("patients_cpf_idx").on(table.cpf),
		stageIdx: index("patients_stage_idx").on(table.stage),
		statusIdx: index("patients_status_idx").on(table.status),
	}),
);

export const patientContacts = mysqlTable("patient_contacts", {
	id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
	patientId: bigint("patient_id", { mode: "number" })
		.notNull()
		.references(() => patients.id, { onDelete: "cascade" }),
	name: varchar("name", { length: 191 }).notNull(),
	relation: varchar("relation", { length: 64 }),
	phone: varchar("phone", { length: 32 }).notNull(),
	createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const patientStatusHistory = mysqlTable("patient_status_history", {
	id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
	patientId: bigint("patient_id", { mode: "number" })
		.notNull()
		.references(() => patients.id, { onDelete: "cascade" }),
	stage: mysqlEnum("stage", ["pre_triage", "in_treatment", "post_treatment"]).notNull(),
	status: mysqlEnum("status", ["active", "inactive", "at_risk"]).notNull(),
	reason: varchar("reason", { length: 255 }),
	recordedAt: datetime("recorded_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export const appointments = mysqlTable(
	"appointments",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		patientId: bigint("patient_id", { mode: "number" })
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		professionalId: bigint("professional_id", { mode: "number" })
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		startsAt: datetime("starts_at", { fsp: 3 }).notNull(),
		type: mysqlEnum("type", ["triage", "treatment", "return"]).notNull(),
		status: mysqlEnum("status", [
			"scheduled",
			"confirmed",
			"completed",
			"no_show",
			"canceled",
		]).notNull().default("scheduled"),
		notes: text("notes"),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
		updatedAt: datetime("updated_at", { fsp: 3 })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		patientTimeIdx: index("appointments_patient_time_idx").on(table.patientId, table.startsAt),
		professionalTimeIdx: index("appointments_professional_time_idx").on(
			table.professionalId,
			table.startsAt,
		),
	}),
);

export const appointmentReminders = mysqlTable(
	"appointment_reminders",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		appointmentId: bigint("appointment_id", { mode: "number" })
			.notNull()
			.references(() => appointments.id, { onDelete: "cascade" }),
		channel: mysqlEnum("channel", ["whatsapp", "sms"]).notNull(),
		recipient: mysqlEnum("recipient", ["patient", "professional"]).notNull().default("patient"),
		scheduledFor: datetime("scheduled_for", { fsp: 3 }).notNull(),
		sentAt: datetime("sent_at", { fsp: 3 }),
		status: mysqlEnum("status", ["queued", "sent", "failed"]).notNull().default("queued"),
		error: text("error"),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		uniqAppointmentReminder: uniqueIndex("appointment_reminders_unique_idx").on(
			table.appointmentId,
			table.channel,
			table.recipient,
			table.scheduledFor,
		),
	}),
);

export const occurrences = mysqlTable(
	"occurrences",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		patientId: bigint("patient_id", { mode: "number" })
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		professionalId: bigint("professional_id", { mode: "number" })
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		kind: varchar("kind", { length: 191 }).notNull(),
		intensity: tinyint("intensity").notNull(),
		source: mysqlEnum("source", ["patient", "professional"]).notNull(),
		notes: text("notes"),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		patientCreatedIdx: index("occurrences_patient_idx").on(table.patientId, table.createdAt),
	}),
);

export const alerts = mysqlTable(
	"alerts",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		patientId: bigint("patient_id", { mode: "number" })
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		kind: varchar("kind", { length: 64 }).notNull(),
		severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull().default("medium"),
		status: mysqlEnum("status", ["open", "acknowledged", "closed"]).notNull().default("open"),
		details: text("details"),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
		resolvedAt: datetime("resolved_at", { fsp: 3 }),
		resolvedBy: bigint("resolved_by", { mode: "number" })
			.references(() => users.id, { onDelete: "set null" }),
	},
	(table) => ({
		patientStatusIdx: index("alerts_patient_status_idx").on(table.patientId, table.status),
	}),
);

export const messages = mysqlTable(
	"messages",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		patientId: bigint("patient_id", { mode: "number" })
			.notNull()
			.references(() => patients.id, { onDelete: "cascade" }),
		channel: mysqlEnum("channel", ["whatsapp", "sms"]).notNull(),
		body: text("body").notNull(),
		mediaUrl: varchar("media_url", { length: 255 }),
		status: mysqlEnum("status", ["queued", "sent", "failed"]).notNull().default("queued"),
		scheduledAt: datetime("scheduled_at", { fsp: 3 }),
		sentAt: datetime("sent_at", { fsp: 3 }),
		error: text("error"),
		appointmentId: bigint("appointment_id", { mode: "number" })
			.references(() => appointments.id, { onDelete: "set null" }),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		channelStatusIdx: index("messages_channel_status_idx").on(table.channel, table.status),
	}),
);

export const auditLogs = mysqlTable(
	"audit_logs",
	{
		id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
		userId: bigint("user_id", { mode: "number" }).references(() => users.id, {
			onDelete: "set null",
		}),
		action: varchar("action", { length: 128 }).notNull(),
		entity: varchar("entity", { length: 128 }).notNull(),
		entityId: bigint("entity_id", { mode: "number" }),
		details: json("details"),
		ipAddress: varchar("ip_address", { length: 45 }),
		userAgent: varchar("user_agent", { length: 255 }),
		createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
	},
	(table) => ({
		actionIdx: index("audit_logs_action_idx").on(table.action),
		entityIdx: index("audit_logs_entity_idx").on(table.entity, table.entityId),
		userIdx: index("audit_logs_user_idx").on(table.userId, table.createdAt),
	}),
);

export const settings = mysqlTable("settings", {
	key: varchar("key", { length: 191 }).primaryKey(),
	value: json("value").notNull(),
	description: varchar("description", { length: 255 }),
	updatedAt: timestamp("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
	updatedBy: bigint("updated_by", { mode: "number" }).references(() => users.id, {
		onDelete: "set null",
	}),
});
