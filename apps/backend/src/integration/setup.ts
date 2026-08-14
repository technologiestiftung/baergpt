import { serve, type ServerType } from "@hono/node-server";
import app from "../index";
import { config } from "../config";

let server: ServerType | null = null;

function assertLocalTarget() {
	let host: string;
	try {
		host = new URL(config.supabaseUrl).hostname;
	} catch {
		throw new Error(`SUPABASE_URL is not a valid URL: "${config.supabaseUrl}"`);
	}

	const localHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
	if (!localHosts.includes(host)) {
		throw new Error(
			`Refusing to run integration tests: SUPABASE_URL points to a non-local target ("${config.supabaseUrl}"). ` +
				`These tests seed and mutate data and are only meant to run against a local Supabase instance. ` +
				`Check your environment variables — they may be pointing at staging/production.`,
		);
	}

	/* eslint-disable-next-line no-console */
	console.log(
		`Running integration tests against local Supabase at ${config.supabaseUrl}`,
	);
}

export async function setup() {
	assertLocalTarget();

	if (server) {
		return;
	}

	server = await new Promise((resolve, reject) => {
		const serverInstance = serve(
			{
				fetch: app.fetch,
				port: 3001,
			},
			() => {
				resolve(serverInstance);
			},
		);
		serverInstance.on("error", (err) => reject(err));
	});
}

export async function teardown() {
	await new Promise<void>((resolve) => {
		if (server?.close) {
			server.close(() => resolve());
		} else {
			resolve();
		}
	});

	server = null;
}
