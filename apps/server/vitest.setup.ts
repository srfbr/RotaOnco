import { vi } from "vitest";

const globalRef = globalThis as unknown as {
	Bun?: {
		password?: {
			hash?: ReturnType<typeof vi.fn>;
			verify?: ReturnType<typeof vi.fn>;
		};
	};
};

if (!globalRef.Bun) {
	globalRef.Bun = {};
}

const password = globalRef.Bun.password ?? {};

if (typeof password.hash !== "function") {
	password.hash = vi.fn(async (input: string) => `hashed:${input}`);
}

if (typeof password.verify !== "function") {
	password.verify = vi.fn().mockResolvedValue(true);
}

globalRef.Bun.password = password;

export {};
