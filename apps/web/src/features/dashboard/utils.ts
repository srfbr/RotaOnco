import type { Alert } from "./api";

type PatientStage = "pre_triage" | "in_treatment" | "post_treatment" | undefined | null;
type PatientStatus = "active" | "inactive" | "at_risk" | undefined | null;

type SeverityInfo = {
	label: string;
	className: string;
};

export function getPatientStageLabel(stage: PatientStage, status: PatientStatus) {
	if (stage === "in_treatment") {
		return { label: "Em tratamento", color: "bg-[#3663D8] text-white" };
	}
	if (stage === "post_treatment") {
		return { label: "Concluído", color: "bg-[#34C759] text-white" };
	}
	if (status === "at_risk") {
		return { label: "Em risco", color: "bg-[#F59E0B] text-white" };
	}
	return { label: "Ativo", color: "bg-[#2563EB]/10 text-[#2563EB]" };
}

export function getPatientStatusDescription(status: PatientStatus) {
	switch (status) {
		case "at_risk":
			return "Paciente com risco de abandono";
		case "inactive":
			return "Paciente inativo";
		case "active":
		default:
			return "Paciente ativo";
	}
}

export function getAlertSeverityInfo(alert: Alert): SeverityInfo {
	switch (alert.severity) {
		case "high":
			return { label: "Crítico", className: "bg-[#FF3B3B] text-white" };
		case "medium":
			return { label: "Importante", className: "bg-[#F59E0B] text-white" };
		case "low":
		default:
			return { label: "Informação", className: "bg-[#2563EB] text-white" };
	}
}

export function formatShortDate(dateIso?: string | null) {
	if (!dateIso) return "N/A";
	const date = new Date(dateIso);
	if (Number.isNaN(date.getTime())) return "N/A";
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	});
}

export function formatDays(days: number | null | undefined) {
	if (days === null || days === undefined) return "-";
	if (Number.isNaN(days)) return "-";
	return `${Math.round(days)} dias`;
}

export function formatPercentage(value: number | null | undefined) {
	if (value === null || value === undefined) return "-";
	return `${Math.round(value * 100)}%`;
}

export function formatCPF(cpf?: string | null) {
	if (!cpf) return "-";
	const digits = cpf.replace(/\D/g, "");
	if (digits.length !== 11) return cpf;
	return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
