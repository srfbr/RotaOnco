import type { InferSelectModel } from "drizzle-orm";
import { alerts } from "../db/schema/core";

export type AlertEntity = InferSelectModel<typeof alerts>;

export interface AlertRepository {
	list(params: {
		professionalId?: number;
		status?: AlertEntity["status"];
		severity?: AlertEntity["severity"];
		limit?: number;
		offset?: number;
	}): Promise<{ data: AlertEntity[]; total: number }>;
	findById(id: number): Promise<AlertEntity | null>;
	update(
		id: number,
		update: {
			status?: AlertEntity["status"];
			details?: string | null;
			resolvedAt?: Date | null;
			resolvedBy?: number | null;
		},
	): Promise<AlertEntity | null>;
}

export function createAlertService(repo: AlertRepository) {
	return {
		listAlerts(input: {
			professionalId?: number;
			status?: AlertEntity["status"];
			severity?: AlertEntity["severity"];
			limit?: number;
			offset?: number;
		}) {
			return repo.list(input);
		},

		getAlert(id: number) {
			return repo.findById(id);
		},

		async updateAlert(
			id: number,
			input: {
				status?: AlertEntity["status"];
				details?: string | null;
				resolvedAt?: Date | null;
			},
			context: { professionalId: number },
		) {
			const existing = await repo.findById(id);
			if (!existing) {
				return null;
			}
			const update: {
				status?: AlertEntity["status"];
				details?: string | null;
				resolvedAt?: Date | null;
				resolvedBy?: number | null;
			} = {};
			if (input.status) {
				update.status = input.status;
				if (input.status === "open") {
					update.resolvedAt = null;
					update.resolvedBy = null;
				} else {
					update.resolvedBy = context.professionalId;
					update.resolvedAt = input.resolvedAt ?? new Date();
				}
			}
			if (input.details !== undefined) {
				update.details = input.details;
			}
			if (input.resolvedAt !== undefined && input.status === undefined) {
				update.resolvedAt = input.resolvedAt;
			}
			if (Object.keys(update).length === 0) {
				return existing;
			}
			return repo.update(id, update);
		},
	};
}

export type AlertService = ReturnType<typeof createAlertService>;
