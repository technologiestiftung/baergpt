import { serve, type ServerType } from "@hono/node-server";
import app from "../index";

let server: ServerType | null = null;

export async function setup() {
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
		serverInstance.on('error', (err) => reject(err));
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
