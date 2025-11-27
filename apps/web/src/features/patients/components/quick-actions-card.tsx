import { Button } from "@/components/ui/button";
import { FilterIcon, UserPlus2 } from "lucide-react";

type QuickActionsCardProps = {
	onResetFilters: () => void;
	onCreatePatient: () => void;
};

export function QuickActionsCard({ onResetFilters, onCreatePatient }: QuickActionsCardProps) {
	return (
		<aside className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<header className="mb-6">
				<h3 className="text-lg font-semibold text-[#3B3D3B]">Ações rápidas</h3>
			</header>
			<div className="space-y-3">
				<Button
					type="button"
					variant="outline"
					className="flex w-full items-center justify-start gap-3 border-[#E5E5E5] text-sm text-[#3B3D3B]"
					onClick={() => onResetFilters()}
				>
					<FilterIcon className="h-4 w-4 text-[#6B7280]" />
					<span>Limpar filtros</span>
				</Button>
				<Button
					type="button"
					variant="outline"
					className="flex w-full items-center justify-start gap-3 border-[#E5E5E5] text-sm text-[#3B3D3B]"
					onClick={onCreatePatient}
				>
					<UserPlus2 className="h-4 w-4 text-[#6B7280]" />
					<span>Novo paciente</span>
				</Button>
			</div>
		</aside>
	);
}
