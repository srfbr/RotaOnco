import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type AppointmentsQuickActionsProps = {
	onCreateAppointment: () => void;
};

export function AppointmentsQuickActions({ onCreateAppointment }: AppointmentsQuickActionsProps) {
	return (
		<section className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<header className="mb-4">
				<h3 className="text-lg font-semibold text-[#3B3D3B]">Ações rápidas</h3>
				<p className="text-sm text-[#6E726E]">Gerencie a agenda com atalhos.</p>
			</header>
			<Button
				type="button"
				variant="default"
				className="w-full justify-center gap-2 border border-transparent bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
				onClick={onCreateAppointment}
			>
				<Plus className="h-4 w-4" />
				Adicionar nova consulta
			</Button>
		</section>
	);
}
