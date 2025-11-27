import { BarChart3 } from "lucide-react";

export function ReportsHero({ totalReports }: { totalReports: number }) {
	const totalLabel = totalReports === 1 ? "relatório disponível" : "relatórios disponíveis";

	return (
		<section className="relative overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
			<div className="relative flex flex-col gap-6 px-8 py-10 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-3">
					<p className="text-sm font-medium uppercase tracking-wide text-[#3663D8]">
						Relatórios de desempenho
					</p>
					<h2 className="text-3xl font-bold leading-tight text-[#3B3D3B] sm:text-[42px] sm:leading-[56px]">
						Dados que impulsionam o cuidado
					</h2>
					<p className="max-w-xl text-base text-[#6E726E]">
						Acompanhe métricas clínico-operacionais para planejar capacidade, reduzir tempos de espera e
						apoiar decisões com segurança.
					</p>
					<div className="flex flex-wrap gap-4">
						<div className="flex items-center gap-2 rounded-full bg-[#F3F6FD] px-4 py-2 text-sm font-semibold text-[#3663D8]">
							<BarChart3 className="h-4 w-4" />
							{totalReports} {totalLabel}
						</div>
					</div>
				</div>
				<div className="flex flex-col items-end gap-3 rounded-lg bg-[#F3F6FD] px-6 py-5 text-right text-[#3663D8]">
					<span className="text-xs uppercase tracking-wide text-[#6E726E]">Insights rápidos</span>
					<p className="text-base font-semibold">
						Monitore tempos de espera, adesão e presença com um só painel.
					</p>
				</div>
			</div>
			<div className="pointer-events-none absolute -right-[120px] top-1/2 size-[240px] -translate-y-1/2 rounded-full bg-gradient-to-br from-[#AEC4FA] via-[#D6E1FB] to-[#F3F6FD] opacity-60 blur-2xl" />
		</section>
	);
}
