import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Ellipsis } from "lucide-react";
import type { TeamMember } from "../data";
import { formatDate, formatRoles, getStatusBadge } from "../utils";

const HEADER_CLASS = "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]";
const CELL_CLASS = "px-6 py-4 text-sm text-[#4B5563]";

type TeamTableProps = {
	members: TeamMember[];
	isLoading?: boolean;
	onDelete?: (member: TeamMember) => void;
	onToggleStatus?: (member: TeamMember) => void;
	busyMemberId?: number | null;
};

export function TeamTable({ members, isLoading, onDelete, onToggleStatus, busyMemberId }: TeamTableProps) {
	if (isLoading) {
		return <TableSkeleton />;
	}

	if (members.length === 0) {
		return (
			<div className="px-8 py-10 text-sm text-[#6E726E]">
				Nenhum profissional encontrado para os filtros selecionados.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full divide-y divide-[#E5E5E5]">
				<thead className="bg-[#F9FAFB]">
					<tr>
						<th scope="col" className={HEADER_CLASS}>Nome</th>
						<th scope="col" className={HEADER_CLASS}>Especialidade</th>
						<th scope="col" className={HEADER_CLASS}>Documento</th>
						<th scope="col" className={HEADER_CLASS}>Telefone</th>
						<th scope="col" className={HEADER_CLASS}>E-mail</th>
						<th scope="col" className={HEADER_CLASS}>Status</th>
						<th scope="col" className={HEADER_CLASS}>Papéis</th>
						<th scope="col" className={HEADER_CLASS}>Atualizado em</th>
						<th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
							Ações
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#E5E5E5]">
					{members.map((member) => {
						const statusBadge = getStatusBadge(member.status);
						const isInactive = member.status === "inactive";
						const isBusy = busyMemberId === member.id;
						return (
							<tr key={member.id} className="hover:bg-[#F3F6FD]/60">
								<td className={CELL_CLASS}>
									<div className="flex flex-col">
										<span className="font-semibold text-[#111827]">{member.fullName}</span>
										<span className="text-xs text-[#9CA3AF]">ID #{member.id}</span>
									</div>
								</td>
								<td className={CELL_CLASS}>{member.specialty ?? "—"}</td>
								<td className={CELL_CLASS}>{member.documentId}</td>
								<td className={CELL_CLASS}>{member.phone ?? "—"}</td>
								<td className={CELL_CLASS}>{member.email}</td>
								<td className={CELL_CLASS}>
									<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}>
										{statusBadge.label}
									</span>
								</td>
								<td className={CELL_CLASS}>{formatRoles(member.roles)}</td>
								<td className={CELL_CLASS}>{formatDate(member.updatedAt)}</td>
								<td className="px-6 py-4 text-right">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												disabled={isBusy}
												className="text-[#6B7280] hover:text-[#3663D8]"
											>
												<Ellipsis className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-40">
											<DropdownMenuItem
												disabled={isBusy}
												onSelect={() => onToggleStatus?.(member)}
											>
												{isInactive ? "Ativar" : "Desativar"}
											</DropdownMenuItem>
											<DropdownMenuItem
												variant="destructive"
												disabled={isBusy}
												onSelect={() => onDelete?.(member)}
											>
												Excluir
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function TableSkeleton() {
	return (
		<div className="space-y-4 px-6 py-6">
			{Array.from({ length: 5 }).map((_, index) => (
				<div key={index} className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 rounded-lg border border-[#E5E5E5] bg-white p-4">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-4 w-56" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-4 w-24" />
				</div>
			))}
		</div>
	);
}
