import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { asc, sql } from "drizzle-orm";

import { db } from "../db";
import {
	roles,
	users,
	userRoles,
	patients,
	patientContacts,
	patientStatusHistory,
	appointments,
	appointmentReminders,
	occurrences,
	alerts,
	messages,
	auditLogs,
	settings,
} from "./schema/core";
import { user as authUsers } from "./schema/auth";

async function seed() {
	console.info("🌱 Seeding database...");

	const adminAuthId = "00000000-0000-0000-0000-000000000001";
	const adminEmail = "admin@rotaonco.local";
	const adminDocument = "00000000000";

	await db
		.insert(roles)
		.values([
			{ id: 1, name: "admin", description: "Administrador do sistema" },
			{ id: 2, name: "professional", description: "Profissional de saúde" },
		])
		.onDuplicateKeyUpdate({
			set: {
				description: sql`VALUES(description)`,
			},
		});

	const now = new Date();

	await db
		.insert(authUsers)
		.values({
			id: adminAuthId,
			name: "Administrador RotaOnco",
			email: adminEmail,
			emailVerified: true,
			image: null,
			createdAt: now,
			updatedAt: now,
		})
		.onDuplicateKeyUpdate({
			set: {
				name: sql`VALUES(name)`,
				emailVerified: sql`VALUES(email_verified)`,
				updatedAt: sql`VALUES(updated_at)`,
			},
		});

	await db
		.insert(users)
		.values({
			externalId: adminAuthId,
			name: "Administrador RotaOnco",
			email: adminEmail,
			documentId: adminDocument,
			specialty: "Coordenação",
			phone: "+55 11 99999-0000",
			isActive: true,
			createdAt: now,
			updatedAt: now,
		})
		.onDuplicateKeyUpdate({
			set: {
				name: sql`VALUES(name)`,
				specialty: sql`VALUES(specialty)`,
				phone: sql`VALUES(phone)`,
				updatedAt: sql`VALUES(updated_at)`,
			},
		});

	const [adminUser] = await db
		.select()
		.from(users)
		.where(eq(users.externalId, adminAuthId))
		.limit(1);

	if (!adminUser) {
		throw new Error("Administrador não encontrado após seed");
	}

	await db
		.insert(userRoles)
		.values({
			userId: adminUser.id,
			roleId: 1,
		})
		.onDuplicateKeyUpdate({
			set: {
				assignedAt: sql`VALUES(assigned_at)`,
			},
		});

	const patientCpf = "11111111111";
	const patientPinHash = await Bun.password.hash("1234");

	await db
		.insert(patients)
		.values({
			fullName: "Paciente Exemplo",
			cpf: patientCpf,
			birthDate: new Date("1990-05-20"),
			phone: "+55 11 98888-7777",
			emergencyPhone: "+55 11 97777-6666",
			tumorType: "Carcinoma",
			clinicalUnit: "Unidade São Paulo",
			stage: "pre_triage",
			status: "active",
			audioMaterialUrl: "https://cdn.example.com/audio/cuidados.mp3",
			pinHash: patientPinHash,
			pinAttempts: 0,
		})
		.onDuplicateKeyUpdate({
			set: {
				fullName: sql`VALUES(full_name)`,
				stage: sql`VALUES(stage)`,
				status: sql`VALUES(status)`,
				updatedAt: sql`VALUES(updated_at)`,
			},
		});

	const [patient] = await db
		.select()
		.from(patients)
		.where(eq(patients.cpf, patientCpf))
		.limit(1);

	if (!patient) {
		throw new Error("Paciente exemplo não encontrado após seed");
	}

	const [existingContact] = await db
		.select()
		.from(patientContacts)
		.where(
			and(
				eq(patientContacts.patientId, patient.id),
				eq(patientContacts.name, "Maria Exemplo"),
			),
		)
		.limit(1);

	if (!existingContact) {
		await db.insert(patientContacts).values({
			patientId: patient.id,
			name: "Maria Exemplo",
			relation: "Responsável",
			phone: "+55 11 96666-5555",
		});
	}

	const [existingStatus] = await db
		.select()
		.from(patientStatusHistory)
		.where(
			and(
				eq(patientStatusHistory.patientId, patient.id),
				eq(patientStatusHistory.stage, patient.stage),
				eq(patientStatusHistory.status, patient.status),
			),
		)
		.limit(1);

	if (!existingStatus) {
		await db.insert(patientStatusHistory).values({
			patientId: patient.id,
			stage: patient.stage,
			status: patient.status,
			reason: "Cadastro inicial",
		});
	}

	const appointmentStart = new Date();
	appointmentStart.setDate(appointmentStart.getDate() + 7);
	appointmentStart.setHours(9, 0, 0, 0);

	let [appointment] = await db
		.select()
		.from(appointments)
		.where(
			and(
				eq(appointments.patientId, patient.id),
				eq(appointments.startsAt, appointmentStart),
			),
		)
		.orderBy(asc(appointments.id))
		.limit(1);

	if (!appointment) {
		await db.insert(appointments).values({
			patientId: patient.id,
			professionalId: adminUser.id,
			startsAt: appointmentStart,
			type: "treatment",
			status: "scheduled",
			notes: "Retorno quinzenal",
		});

		[appointment] = await db
			.select()
			.from(appointments)
			.where(
				and(
					eq(appointments.patientId, patient.id),
					eq(appointments.startsAt, appointmentStart),
				),
			)
			.orderBy(asc(appointments.id))
			.limit(1);
	}

	if (!appointment) {
		throw new Error("Consulta não encontrada após seed");
	}

	const reminderTime = new Date(appointment.startsAt);
	reminderTime.setDate(reminderTime.getDate() - 1);
	reminderTime.setHours(9, 0, 0, 0);

	const [existingReminder] = await db
		.select()
		.from(appointmentReminders)
		.where(
			and(
				eq(appointmentReminders.appointmentId, appointment.id),
				eq(appointmentReminders.channel, "whatsapp"),
			),
		)
		.limit(1);

	if (!existingReminder) {
		await db.insert(appointmentReminders).values({
			appointmentId: appointment.id,
			channel: "whatsapp",
			scheduledFor: reminderTime,
		});
	}

	const [existingOccurrence] = await db
		.select()
		.from(occurrences)
		.where(
			and(
				eq(occurrences.patientId, patient.id),
				eq(occurrences.kind, "dor"),
			),
		)
		.limit(1);

	if (!existingOccurrence) {
		await db.insert(occurrences).values({
			patientId: patient.id,
			professionalId: adminUser.id,
			kind: "dor",
			intensity: 4,
			source: "professional",
			notes: "Paciente relatou dor leve ao mastigar.",
		});
	}

	const [existingAlert] = await db
		.select()
		.from(alerts)
		.where(
			and(
				eq(alerts.patientId, patient.id),
				eq(alerts.kind, "falta_consecutiva"),
			),
		)
		.limit(1);

	if (!existingAlert) {
		await db.insert(alerts).values({
			patientId: patient.id,
			kind: "falta_consecutiva",
			severity: "medium",
			status: "open",
			details: "Paciente faltou duas consultas consecutivas.",
		});
	}

	const [existingMessage] = await db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.patientId, patient.id),
				eq(messages.appointmentId, appointment.id),
			),
		)
		.limit(1);

	if (!existingMessage) {
		await db.insert(messages).values({
			patientId: patient.id,
			channel: "whatsapp",
			body: "Olá, lembrete da sua consulta agendada.",
			status: "queued",
			scheduledAt: reminderTime,
			appointmentId: appointment.id,
		});
	}

	const [existingSeedLog] = await db
		.select()
		.from(auditLogs)
		.where(
			and(
				eq(auditLogs.action, "SEED"),
				eq(auditLogs.entity, "seed"),
			),
		)
		.limit(1);

	if (!existingSeedLog) {
		await db.insert(auditLogs).values({
			userId: adminUser.id,
			action: "SEED",
			entity: "seed",
			details: { message: "Seed inicial executado" },
		});
	}

	await db
		.insert(settings)
		.values({
			key: "emergency_contacts",
			value: [{ label: "Central de Emergência", phone: "+55 11 93456-0000" }],
			description: "Telefones de contato rápido exibidos no app do paciente",
			updatedBy: adminUser.id,
		})
		.onDuplicateKeyUpdate({
			set: {
				value: sql`VALUES(value)`
			},
		});

	console.info("✅ Seed concluído");
}

seed()
	.then(() => {
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ Seed falhou", error);
		process.exit(1);
	});
