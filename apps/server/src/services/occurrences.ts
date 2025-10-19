import type { InferSelectModel } from "drizzle-orm";
import { occurrences } from "../db/schema/core";

export type OccurrenceEntity = InferSelectModel<typeof occurrences>;

export type OccurrenceListFilters = {
	start?: Date;
	end?: Date;
	kind?: string | null;
};

export interface OccurrenceRepository {
	createOccurrence(input: {
		patientId: number;
		professionalId: number;
		kind: string;
		intensity: number;
		source: OccurrenceEntity["source"];
		notes?: string | null;
	}): Promise<OccurrenceEntity>;
	listByPatient(patientId: number, filters?: OccurrenceListFilters): Promise<OccurrenceEntity[]>;
}

export interface AuditPort {
	record(action: string, entityId: number, details: Record<string, unknown>): Promise<void>;
}

export function createOccurrenceService(deps: {
	repository: OccurrenceRepository;
	audit: AuditPort;
}) {
	const { repository, audit } = deps;

	return {
		listPatientOccurrences(patientId: number, filters?: { start?: Date; end?: Date; kind?: string }) {
			const normalized: OccurrenceListFilters | undefined = filters
				? {
					start: filters.start,
					end: filters.end,
					kind: filters.kind ? filters.kind.trim() : undefined,
				}
				: undefined;
			return repository.listByPatient(patientId, normalized);
		},

		async createOccurrence(
			patientId: number,
			input: {
				kind: string;
				intensity: number;
				source: OccurrenceEntity["source"];
				notes?: string | null;
			},
			context: { professionalId: number },
		) {
			const occurrence = await repository.createOccurrence({
				patientId,
				professionalId: context.professionalId,
				kind: input.kind.trim(),
				intensity: input.intensity,
				source: input.source,
				notes: input.notes ? input.notes.trim() : null,
			});

			await audit.record("OCCURRENCE_CREATED", occurrence.id, {
				patientId,
				professionalId: context.professionalId,
				kind: occurrence.kind,
				intensity: occurrence.intensity,
				source: occurrence.source,
			});

			return occurrence;
		},
	};
}

export type OccurrenceService = ReturnType<typeof createOccurrenceService>;
