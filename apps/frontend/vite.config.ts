import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { config } from "dotenv";

config();

export default defineConfig({
	plugins: [
		react(),
		sentryVitePlugin({
			org: process.env.VITE_SENTRY_ORG,
			project: process.env.VITE_SENTRY_PROJECT,
			authToken: process.env.SENTRY_AUTH_TOKEN,
			sourcemaps: {
				disable: process.env.NODE_ENV === "test",
			},
		}),
	],
	base: "/",
	define: {
		"import.meta.env.VITE_VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV),
		"import.meta.env.VITE_BUILD_TIMESTAMP": JSON.stringify(
			Date.now().toString(),
		),
	},
	server: {
		port: parseInt(process.env.VITE_PORT || "5173", 10),
	},
	build: {
		sourcemap: true,
	},
});
