import type { Professional } from "./api";

export type ProfileViewModel = {
	id: number;
	fullName: string;
	email: string;
	documentId: string;
	specialty?: string | null;
	phone?: string | null;
	avatarUrl?: string | null;
	roles: Professional["roles"];
	roleLabel: string;
	isActive?: boolean;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export function toProfileViewModel(professional: Professional): ProfileViewModel {
	return {
		id: professional.id,
		fullName: professional.name,
		email: professional.email,
		documentId: professional.documentId,
		specialty: professional.specialty,
		phone: professional.phone,
		avatarUrl: professional.avatarUrl,
		roles: professional.roles,
		roleLabel: resolveRoleLabel(professional.roles),
		isActive: professional.isActive,
		createdAt: professional.createdAt,
		updatedAt: professional.updatedAt,
	};
}

function resolveRoleLabel(roles: Professional["roles"]) {
	if (roles.includes("admin")) {
		return "Administrador";
	}
	if (roles.includes("professional")) {
		return "Profissional";
	}
	return "Usuário";
}
