import { describe, expect, it, vi } from "vitest";
import { createAlertService, type AlertRepository, type AlertEntity } from "../alerts";

describe("createAlertService", () => {
	it("delegates to repository", async () => {
		const sampleAlert: AlertEntity = {
			id: 1,
			patientId: 1,
			kind: "teste",
			severity: "low",
			status: "open",
			details: null,
			createdAt: new Date(),
			resolvedAt: null,
			resolvedBy: null,
		};
		const repo: AlertRepository = {
			list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
			findById: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue(sampleAlert),
			update: vi.fn().mockResolvedValue(null),
		};
		const service = createAlertService(repo);
		const result = await service.listAlerts({ professionalId: 1 });
		expect(repo.list).toHaveBeenCalledWith({ professionalId: 1 });
		expect(result).toEqual({ data: [], total: 0 });
	});
});
