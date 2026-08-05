import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { config } from "dotenv";

config();

const isProductionDeploy =
	process.env.VERCEL_ENV === "production" ||
	process.env.VERCEL_ENV === "staging";

export default defineConfig({
	plugins: [
		react(),
		...(isProductionDeploy
			? [
					sentryVitePlugin({
						// Point the release/source-map upload at our self-hosted Bugsink
						// instance instead of the default sentry.io endpoint.
						url: process.env.VITE_SENTRY_URL,
						org: process.env.VITE_SENTRY_ORG,
						project: process.env.VITE_SENTRY_PROJECT,
						authToken: process.env.SENTRY_AUTH_TOKEN,
						sourcemaps: {
							disable: process.env.NODE_ENV === "test",
						},
						// Bugsink doesn't implement the legacy "releases" API, so the
						// `sentry-cli releases new` call 404s. Source maps are matched via
						// debug IDs (artifact bundles), so we don't need releases at all.
						release: {
							create: false,
							finalize: false,
						},
					}),
				]
			: []),
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
		rolldownOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (
							["react", "react-dom", "react-router"].some((pkg) =>
								id.includes(`node_modules/${pkg}/`),
							)
						) {
							return "vendor-react";
						}
						if (
							[
								"react-markdown",
								"remark-gfm",
								"remark-rehype",
								"rehype-stringify",
							].some((pkg) => id.includes(`node_modules/${pkg}/`))
						) {
							return "vendor-markdown";
						}
						if (id.includes("@react-pdf/renderer")) {
							return "vendor-pdf";
						}
					}
				},
			},
		},
	},
});
