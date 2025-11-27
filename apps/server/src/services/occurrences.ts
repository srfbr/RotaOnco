import type { InferSelectModel } from "drizzle-orm";
import { alerts, occurrences } from "../db/schema/core";
import type { AlertEntity } from "./alerts";

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

type AlertSeverity = typeof alerts.$inferSelect["severity"];
type AlertStatus = typeof alerts.$inferSelect["status"];

export interface AlertPort {
	create(input: {
		patientId: number;
		kind: string;
		severity: AlertSeverity;
		status?: AlertStatus;
		details?: string | null;
		createdAt?: Date;
	}): Promise<AlertEntity>;
}

export function createOccurrenceService(deps: {
	repository: OccurrenceRepository;
	audit: AuditPort;
	alerts?: AlertPort;
}) {
	const { repository, audit, alerts } = deps;

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
			const normalizedNotes = input.notes ? input.notes.trim() : null;
			const occurrence = await repository.createOccurrence({
				patientId,
				professionalId: context.professionalId,
				kind: input.kind.trim(),
				intensity: input.intensity,
				source: input.source,
				notes: normalizedNotes,
			});

			await audit.record("OCCURRENCE_CREATED", occurrence.id, {
				patientId,
				professionalId: context.professionalId,
				kind: occurrence.kind,
				intensity: occurrence.intensity,
				source: occurrence.source,
			});

			if (alerts && input.source === "patient") {
				const severity = mapIntensityToAlertSeverity(input.intensity);
				const details = buildPatientSymptomAlertDetails(
					occurrence.kind,
					input.intensity,
					normalizedNotes ?? occurrence.notes ?? undefined,
				);
				await alerts.create({
					patientId,
					kind: "sintoma_paciente",
					severity,
					status: "open",
					details,
					createdAt: occurrence.createdAt,
				});
			}

			return occurrence;
		},
	};
}

export type OccurrenceService = ReturnType<typeof createOccurrenceService>;

function mapIntensityToAlertSeverity(intensity: number): AlertSeverity {
	if (!Number.isFinite(intensity)) {
		return "low";
	}
	if (intensity >= 8) {
		return "high";
	}
	if (intensity >= 4) {
		return "medium";
	}
	return "low";
}

function clampIntensity(intensity: number): number {
	if (!Number.isFinite(intensity)) {
		return 0;
	}
	return Math.max(0, Math.min(Math.round(intensity), 10));
}

function buildPatientSymptomAlertDetails(kind: string, intensity: number, notes?: string | null) {
	const cleanedKind = kind.trim();
	const symptom = cleanedKind.length > 0 ? cleanedKind : "Sintoma sem descrição";
	const safeNotes = notes?.trim();
	const intensityDisplay = clampIntensity(intensity);
	const parts = [`Paciente relatou "${symptom}" com intensidade ${intensityDisplay}/10.`];
	if (safeNotes && safeNotes.length > 0) {
		parts.push(`Observações: ${safeNotes}.`);
	}
	return parts.join(" ");
}
