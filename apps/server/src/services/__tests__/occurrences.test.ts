import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOccurrenceService, type OccurrenceRepository, type AuditPort } from "../occurrences";

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
});
