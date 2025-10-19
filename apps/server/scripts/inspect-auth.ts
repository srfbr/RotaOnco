import { auth } from "../src/lib/auth";

async function main() {
	const apiKeys = Object.keys(auth.api as Record<string, unknown>);
	console.log({ apiKeys });
	if (typeof auth.api.getSession === "function") {
		const fn = auth.api.getSession as unknown as Function;
		console.log("getSession arity", fn.length);
		const res = await auth.api.getSession({
			headers: new Headers(),
		});
		console.log("response type", res && res.constructor?.name);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
