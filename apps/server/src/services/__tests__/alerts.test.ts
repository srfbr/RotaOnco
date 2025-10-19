import { describe, expect, it, vi } from "vitest";
import { createAlertService, type AlertRepository } from "../alerts";

describe("createAlertService", () => {
	it("delegates to repository", async () => {
		const repo: AlertRepository = {
			list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
		};
		const service = createAlertService(repo);
		const result = await service.listAlerts({ professionalId: 1 });
		expect(repo.list).toHaveBeenCalledWith({ professionalId: 1 });
		expect(result).toEqual({ data: [], total: 0 });
	});
});
