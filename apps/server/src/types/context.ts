import type { Logger } from "../lib/logger";

export type ProfessionalContext = {
	id: number;
	externalId: string;
	roles: string[];
	name?: string;
	email?: string;
	documentId?: string;
	specialty?: string | null;
	phone?: string | null;
	avatarUrl?: string | null;
	isActive?: boolean;
	mustChangePassword?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
};

export type PatientSession = {
	id: number;
	expiresAt: Date;
};

export type AppEnv = {
	Variables: {
		requestId: string;
		logger: Logger;
		professional?: ProfessionalContext;
		patient?: PatientSession;
	};
};
