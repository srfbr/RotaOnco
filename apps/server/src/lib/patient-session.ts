import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function getSecret(): Uint8Array {
	const secret =
		process.env.PATIENT_SESSION_SECRET ||
		process.env.AUTH_SECRET ||
		"rotaonco-patient-session-secret";
	return encoder.encode(secret);
}

export type PatientSessionPayload = {
	patientId: number;
	sessionId: string;
	expiresAt: Date;
};

const DEFAULT_EXPIRATION = 60 * 60 * 12; // 12h

export async function issuePatientSession(patientId: number, expiresInSeconds = DEFAULT_EXPIRATION) {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
	const token = await new SignJWT({ patientId, sessionId })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
		.sign(getSecret());

	return {
		token,
		session: {
			patientId,
			sessionId,
			expiresAt,
		},
	};
}

export async function verifyPatientSession(token: string): Promise<PatientSessionPayload | null> {
	try {
		const { payload } = await jwtVerify(token, getSecret(), {
			algorithms: ["HS256"],
		});
		const patientId = typeof payload.patientId === "number" ? payload.patientId : Number(payload.patientId);
		if (!patientId || Number.isNaN(patientId)) {
			return null;
		}
		const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : undefined;
		if (!sessionId || typeof payload.exp !== "number") {
			return null;
		}
		return {
			patientId,
			sessionId,
			expiresAt: new Date(payload.exp * 1000),
		};
	} catch (error) {
		return null;
	}
}
