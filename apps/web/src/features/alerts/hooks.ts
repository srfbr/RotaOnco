import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acknowledgeAlert } from "@/features/dashboard/api";
import { fetchAlertById } from "./api";

const ALERT_SCOPE = "alerts";

export function useAlertDetails(alertId: number) {
	const isValidId = Number.isFinite(alertId) && alertId > 0;

	return useQuery({
		queryKey: [ALERT_SCOPE, alertId],
		enabled: isValidId,
		queryFn: async () => {
			const alert = await fetchAlertById(alertId);
			if (!alert) {
				throw new Error("Alerta não encontrado.");
			}
			return alert;
		},
	});
}

export function useAcknowledgeAlert(alertId: number) {
	const queryClient = useQueryClient();
	const isValidId = Number.isFinite(alertId) && alertId > 0;

	return useMutation({
		mutationFn: async () => {
			if (!isValidId) {
				throw new Error("Identificador de alerta inválido.");
			}
			return acknowledgeAlert(alertId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ALERT_SCOPE, alertId] });
			queryClient.invalidateQueries({ queryKey: ["dashboard", "alerts"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
		},
	});
}
