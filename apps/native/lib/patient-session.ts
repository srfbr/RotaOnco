import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "patient_session_cookie";

let cachedCookie: string | null | undefined;
let secureStoreDisabled = false;

async function readFromSecureStore(): Promise<string | null> {
	if (secureStoreDisabled) {
		return null;
	}

	try {
		const stored = await SecureStore.getItemAsync(STORAGE_KEY);
		return stored ?? null;
	} catch (error) {
		secureStoreDisabled = true;
		return null;
	}
}

async function writeToSecureStore(value: string | null): Promise<void> {
	if (secureStoreDisabled) {
		return;
	}

	try {
		if (value) {
			await SecureStore.setItemAsync(STORAGE_KEY, value);
		} else {
			await SecureStore.deleteItemAsync(STORAGE_KEY);
		}
	} catch (error) {
		secureStoreDisabled = true;
	}
}

export async function getPatientSessionCookie(): Promise<string | null> {
	if (cachedCookie !== undefined) {
		return cachedCookie;
	}

	cachedCookie = await readFromSecureStore();
	return cachedCookie;
}

export async function setPatientSessionCookie(cookie: string | null): Promise<void> {
	cachedCookie = cookie;
	await writeToSecureStore(cookie);
}

export async function clearPatientSessionCookie(): Promise<void> {
	cachedCookie = null;
	await writeToSecureStore(null);
}
