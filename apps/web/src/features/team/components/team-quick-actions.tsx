import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProfessionalInviteDialog } from "./professional-invite-dialog";

export function TeamQuickActions() {
	const [isInviteOpen, setIsInviteOpen] = useState(false);

	return (
		<section className="rounded-xl border border-[#E5E5E5] bg-white p-6">
			<header className="mb-4 space-y-1">
				<h3 className="text-lg font-semibold text-[#3B3D3B]">Ações rápidas</h3>
				<p className="text-sm text-[#6E726E]">Convide novos profissionais ou atualize a equipe.</p>
			</header>
			<div className="space-y-3">
				<Button
					type="button"
					className="w-full justify-center gap-2 bg-[#3663D8] text-white hover:bg-[#2D52B1]"
					onClick={() => setIsInviteOpen(true)}
				>
					<Plus className="h-4 w-4" />
					Adicionar profissional
				</Button>
			</div>
			<ProfessionalInviteDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
		</section>
	);
}
