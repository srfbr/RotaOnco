import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createOccurrenceService,
	type OccurrenceRepository,
	type AuditPort,
	type AlertPort,
} from "../occurrences";

const occurrence = {
	id: 1,
	patientId: 99,
	professionalId: 42,
	kind: "dor",
	intensity: 7,
	source: "professional" as const,
	notes: "Paciente relatou dor",
	createdAt: new Date(),
};

describe("createOccurrenceService", () => {
	let repository: OccurrenceRepository;
	let audit: AuditPort;

	beforeEach(() => {
		repository = {
			createOccurrence: vi.fn().mockResolvedValue(occurrence),
			listByPatient: vi.fn().mockResolvedValue([occurrence]),
		};
		audit = {
			record: vi.fn().mockResolvedValue(undefined),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lists occurrences for patient", async () => {
		const service = createOccurrenceService({ repository, audit });
		const result = await service.listPatientOccurrences(occurrence.patientId);
		expect(repository.listByPatient).toHaveBeenCalledWith(occurrence.patientId, undefined);
		expect(result).toEqual([occurrence]);
	});

	it("passes filters when listing occurrences", async () => {
		const service = createOccurrenceService({ repository, audit });
		const start = new Date();
		const end = new Date(Date.now() + 3_600_000);
		await service.listPatientOccurrences(occurrence.patientId, { start, end, kind: " dor " });
		expect(repository.listByPatient).toHaveBeenCalledWith(occurrence.patientId, {
			start,
			end,
			kind: "dor",
		});
	});

	it("creates occurrence and records audit", async () => {
		const service = createOccurrenceService({ repository, audit });
		const result = await service.createOccurrence(
			occurrence.patientId,
			{ kind: " dor ", intensity: occurrence.intensity, source: occurrence.source, notes: occurrence.notes },
			{ professionalId: occurrence.professionalId },
		);

		expect(repository.createOccurrence).toHaveBeenCalledWith({
			patientId: occurrence.patientId,
			professionalId: occurrence.professionalId,
			kind: "dor",
			intensity: occurrence.intensity,
			source: occurrence.source,
			notes: occurrence.notes,
		});
		expect(audit.record).toHaveBeenCalledWith("OCCURRENCE_CREATED", occurrence.id, {
			patientId: occurrence.patientId,
			professionalId: occurrence.professionalId,
			kind: occurrence.kind,
			intensity: occurrence.intensity,
			source: occurrence.source,
		});
		expect(result).toEqual(occurrence);
	});

	it("creates alert when patient reports a symptom", async () => {
		const createdAt = new Date("2024-01-02T12:00:00Z");
		const patientOccurrence = {
			...occurrence,
			source: "patient" as const,
			intensity: 9,
			kind: "Febre alta",
			notes: "Observou febre",
			createdAt,
		};
		(repository.createOccurrence as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(patientOccurrence);
		const alerts: AlertPort = {
			create: vi.fn().mockResolvedValue({
				id: 123,
				patientId: patientOccurrence.patientId,
				kind: "sintoma_paciente",
				severity: "high",
				status: "open",
				details: null,
				createdAt,
				resolvedAt: null,
				resolvedBy: null,
			}),
		};
		const service = createOccurrenceService({ repository, audit, alerts });
		await service.createOccurrence(
			patientOccurrence.patientId,
			{
				kind: " Febre alta ",
				intensity: patientOccurrence.intensity,
				source: patientOccurrence.source,
				notes: " Observou febre ",
			},
			{ professionalId: patientOccurrence.professionalId },
		);

		expect(alerts.create).toHaveBeenCalledWith({
			patientId: patientOccurrence.patientId,
			kind: "sintoma_paciente",
			severity: "high",
			status: "open",
			details: 'Paciente relatou "Febre alta" com intensidade 9/10. Observações: Observou febre.',
			createdAt,
		});
	});
});
