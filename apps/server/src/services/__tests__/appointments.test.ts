import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createAppointmentService,
	type AppointmentRepository,
	type AuditPort,
} from "../appointments";

const appointment = {
	id: 1,
	patientId: 99,
	professionalId: 7,
	startsAt: new Date(),
	type: "triage" as const,
	status: "scheduled" as const,
	notes: null as string | null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("createAppointmentService", () => {
	let repo: AppointmentRepository;
	let audit: AuditPort;

	beforeEach(() => {
		repo = {
			findById: vi.fn().mockResolvedValue(appointment),
			listAppointments: vi.fn().mockResolvedValue({ data: [appointment], total: 1 }),
			createAppointment: vi.fn().mockResolvedValue(appointment),
			updateAppointment: vi.fn().mockResolvedValue({ ...appointment, notes: "updated" }),
			findDetailById: vi.fn().mockResolvedValue(null),
			updateStatus: vi.fn().mockResolvedValue(undefined),
			hasConflict: vi.fn().mockResolvedValue(false),
		};
		audit = {
			record: vi.fn().mockResolvedValue(undefined),
		};
	});

	it("confirms appointment when belongs to patient", async () => {
		const service = createAppointmentService({ appointments: repo, audit });
		const status = await service.confirmAttendance(appointment.id, appointment.patientId);

		expect(status).toBe("confirmed");
		expect(repo.updateStatus).toHaveBeenCalledWith(appointment.id, "confirmed");
		expect(audit.record).toHaveBeenCalledWith(
			"APPOINTMENT_CONFIRMED",
			appointment.id,
			expect.objectContaining({ patientId: appointment.patientId }),
		);
	});

	it("throws when appointment not found", async () => {
		(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		const service = createAppointmentService({ appointments: repo, audit });
		await expect(service.confirmAttendance(1, appointment.patientId)).rejects.toThrowError(
			"APPOINTMENT_NOT_FOUND",
		);
	});

	it("ignores update when already confirmed", async () => {
		(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
			...appointment,
			status: "confirmed" as const,
		});
		const service = createAppointmentService({ appointments: repo, audit });
		const status = await service.confirmAttendance(appointment.id, appointment.patientId);
		expect(status).toBe("confirmed");
		expect(repo.updateStatus).not.toHaveBeenCalled();
	});

	it("creates appointment when no conflict", async () => {
		const startsAt = new Date();
		const service = createAppointmentService({ appointments: repo, audit });
		const created = await service.createAppointment(
			{ patientId: 2, professionalId: 7, startsAt, type: "treatment", notes: "  follow up " },
			{ professionalId: 7 },
		);

		expect(repo.hasConflict).toHaveBeenCalledWith({ professionalId: 7, excludeId: undefined, startsAt });
		expect(repo.createAppointment).toHaveBeenCalledWith(
			expect.objectContaining({ notes: "follow up" }),
		);
		expect(created).toEqual(appointment);
		expect(audit.record).toHaveBeenCalledWith(
			"APPOINTMENT_CREATED",
			appointment.id,
			expect.objectContaining({ professionalId: 7, patientId: appointment.patientId }),
		);
	});

	it("throws on conflict when creating appointment", async () => {
		(repo.hasConflict as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		const service = createAppointmentService({ appointments: repo, audit });
		await expect(
			service.createAppointment(
				{ patientId: 2, professionalId: 7, startsAt: new Date(), type: "triage" },
				{ professionalId: 7 },
			),
		).rejects.toThrowError("APPOINTMENT_CONFLICT");
		expect(repo.createAppointment).not.toHaveBeenCalled();
	});

	it("updates appointment fields and records audit", async () => {
		const service = createAppointmentService({ appointments: repo, audit });
		const newDate = new Date(Date.now() + 60_000);
		repo.updateAppointment = vi.fn().mockResolvedValue({ ...appointment, startsAt: newDate, type: "return" });

		const updated = await service.updateAppointment(
			appointment.id,
			{ startsAt: newDate, notes: "  note  " },
			{ professionalId: appointment.professionalId },
		);

		expect(repo.hasConflict).toHaveBeenCalledWith({
			professionalId: appointment.professionalId,
			excludeId: appointment.id,
			startsAt: newDate,
		});
		expect(repo.updateAppointment).toHaveBeenCalledWith(
			appointment.id,
			expect.objectContaining({ startsAt: newDate, notes: "note" }),
		);
		expect(updated?.startsAt).toBe(newDate);
		expect(audit.record).toHaveBeenCalledWith(
			"APPOINTMENT_UPDATED",
			appointment.id,
			expect.objectContaining({ professionalId: appointment.professionalId }),
		);
	});

	it("cancels appointment and records audit", async () => {
		const service = createAppointmentService({ appointments: repo, audit });
		await service.cancelAppointment(appointment.id, {
			professionalId: appointment.professionalId,
			reason: " paciente solicitou ",
		});

		expect(repo.updateStatus).toHaveBeenCalledWith(
			appointment.id,
			"canceled",
			"paciente solicitou",
		);
		expect(audit.record).toHaveBeenCalledWith(
			"APPOINTMENT_CANCELED",
			appointment.id,
			expect.objectContaining({ professionalId: appointment.professionalId }),
		);
	});

	it("declines appointment for patient", async () => {
		const service = createAppointmentService({ appointments: repo, audit });
		await service.declineAppointment(appointment.id, appointment.patientId, " indisponível ");

		expect(repo.updateStatus).toHaveBeenCalledWith(
			appointment.id,
			"no_show",
			"indisponível",
		);
		expect(audit.record).toHaveBeenCalledWith(
			"APPOINTMENT_DECLINED",
			appointment.id,
			expect.objectContaining({ patientId: appointment.patientId }),
		);
	});
});

