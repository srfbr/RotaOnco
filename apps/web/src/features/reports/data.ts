export type WaitTimeReportPoint = {
	month: string;
	label: string;
	value: number;
};

export const WAIT_TIME_REPORT: WaitTimeReportPoint[] = [
	{ month: "jan", label: "Jan", value: 6 },
	{ month: "fev", label: "Fev", value: 15 },
	{ month: "mar", label: "Mar", value: 10 },
	{ month: "abr", label: "Abr", value: 11 },
	{ month: "mai", label: "Mai", value: 9 },
	{ month: "jun", label: "Jun", value: 16 },
	{ month: "jul", label: "Jul", value: 8 },
	{ month: "ago", label: "Ago", value: 15 },
	{ month: "set", label: "Set", value: 5 },
	{ month: "out", label: "Out", value: 11 },
	{ month: "nov", label: "Nov", value: 7 },
	{ month: "dez", label: "Dez", value: 10 },
];

export type ReportKind = "wait-times" | "adherence" | "attendance" | "alerts";

export const REPORT_ACTION_GROUPS = [
	{
		title: "Relatório de tempo",
		actions: ["Visualizar"],
		reportKind: "wait-times" as ReportKind,
	},
	{
		title: "Relatório de adesão",
		actions: ["Visualizar"],
		reportKind: "adherence" as ReportKind,
	},
	{
		title: "Relatório de presença",
		actions: ["Visualizar"],
		reportKind: "attendance" as ReportKind,
	},
	{
		title: "Relatório de alertas",
		actions: ["Visualizar"],
		reportKind: "alerts" as ReportKind,
	},
] as const;
