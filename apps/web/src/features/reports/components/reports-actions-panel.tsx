import { FileText, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_ACTION_GROUPS, type ReportKind } from "../data";

const ICONS = [FileText, Layers];

type ReportsActionsPanelProps = {
	activeReport: ReportKind;
	onSelectReport: (report: ReportKind) => void;
};

export function ReportsActionsPanel({ activeReport, onSelectReport }: ReportsActionsPanelProps) {
	return (
		<section className="flex flex-col gap-4">
			{REPORT_ACTION_GROUPS.map((group, index) => {
				const Icon = ICONS[index % ICONS.length];
				return (
					<article
						key={group.title}
						className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-[0px_1px_2px_rgba(16,24,40,0.05)]"
					>
						<header className="mb-4 flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F3F6FD] text-[#3663D8]">
								<Icon className="h-5 w-5" />
							</div>
							<div>
								<h3 className="text-base font-semibold text-[#3B3D3B]">{group.title}</h3>
								<p className="text-sm text-[#6E726E]">Selecione qual relatório deseja visualizar agora.</p>
							</div>
						</header>
						<div className="flex flex-wrap gap-2">
							{group.reportKind ? (
								<Button
									type="button"
									variant={activeReport === group.reportKind ? "default" : "outline"}
									className={
										activeReport === group.reportKind
											? "gap-2 bg-[#3663D8] text-white hover:bg-[#2D52B1]"
											: "gap-2 border-[#CBD5F5] text-[#3663D8] hover:bg-[#F3F6FD]"
									}
									onClick={() => onSelectReport(group.reportKind)}
								>
									{group.actions[0] ?? "Visualizar"}
								</Button>
							) : null}
						</div>
					</article>
				);
			})}
		</section>
	);
}
