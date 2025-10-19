import type { Logger } from "../lib/logger";

export type ProfessionalContext = {
	id: number;
	externalId: string;
	roles: string[];
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
