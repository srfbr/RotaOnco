import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

import type { AppEnv } from "./types/context";
import { requestContext } from "./middlewares/request-context";
import { errorHandler } from "./middlewares/error-handler";
import { rateLimit } from "./middlewares/rate-limit";
import { createAppRouter } from "./routers";
import { createPatientAuthService } from "./services/patient-auth";
import { createPatientService } from "./services/patients";
import { createPatientManagementService } from "./services/patient-management";
import { createAppointmentService } from "./services/appointments";
import { createAlertService } from "./services/alerts";
import { createReportsService } from "./services/reports";
import { createOccurrenceService } from "./services/occurrences";
import { patientAuthRepository } from "./repositories/patient-auth";
import { patientsRepository } from "./repositories/patients";
import { patientManagementRepository } from "./repositories/patient-management";
import { appointmentsRepository } from "./repositories/appointments";
import { alertsRepository } from "./repositories/alerts";
import { reportsRepository } from "./repositories/reports";
import { occurrencesRepository } from "./repositories/occurrences";
import { issuePatientSession } from "./lib/patient-session";
import { insertAuditLog } from "./repositories/audit";

const app = new Hono<AppEnv>();

app.use("*", requestContext);
app.use("*", errorHandler);
app.use("*", honoLogger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

const patientAuthService = createPatientAuthService({
	patients: patientAuthRepository,
	audit: {
		record: (action, entityId, details) =>
			insertAuditLog(action, "patient", entityId, details ?? {}, null),
	},
	sessions: {
		async create(patientId) {
			const { token, session } = await issuePatientSession(patientId);
			return {
				token,
				expiresAt: session.expiresAt,
			};
		},
	},
});

const patientService = createPatientService(patientsRepository);

const patientManagementService = createPatientManagementService({
	repository: patientManagementRepository,
	audit: {
		record: (action, entityId, details) =>
			insertAuditLog(action, "patient", entityId, details ?? {}, null),
	},
});

const appointmentService = createAppointmentService({
	appointments: appointmentsRepository,
	audit: {
		record: (action, entityId, details) =>
			insertAuditLog(action, "appointment", entityId, details ?? {}, null),
	},
});

const alertService = createAlertService(alertsRepository);

const reportsService = createReportsService(reportsRepository);

const occurrenceService = createOccurrenceService({
	repository: occurrencesRepository,
	audit: {
		record: (action, entityId, details) =>
			insertAuditLog(action, "occurrence", entityId, details ?? {}, null),
	},
});

const patientLoginRateLimit = rateLimit({
	windowMs: 60_000,
	max: 5,
	keyGenerator: (c) => {
		const ip =
			c.req.header("cf-connecting-ip") ||
			c.req.header("x-forwarded-for") ||
			c.req.header("x-real-ip") ||
			c.req.header("x-client-ip") ||
			c.req.raw.headers.get("x-forwarded-for") ||
			"anonymous";
		return `${ip}:patient-pin`;
	},
});

const apiRouter = createAppRouter({
	patientAuth: patientAuthService,
	patients: patientService,
	patientManagement: patientManagementService,
	appointments: appointmentService,
	alerts: alertService,
	reports: reportsService,
	occurrences: occurrenceService,
	patientLoginRateLimit,
});

app.route("/api", apiRouter);

app.get("/", (c) => c.text("OK"));

export default app;
