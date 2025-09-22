import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
	plugins: [
		react(),
		sentryVitePlugin({
			// TODO: use env variables
			org: "technologiestiftung-berlin",
			project: "baergpt-frontend",
			authToken: process.env.SENTRY_AUTH_TOKEN,
			sourcemaps: {
				disable: process.env.NODE_ENV === "test",
			},
		}),
	],
	base: "/",
	define: {
		"import.meta.env.VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV),
	},
	server: {
		port: parseInt(process.env.VITE_PORT || "5173", 10),
	},
	build: {
		sourcemap: true,
	},
});
