import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: mode === "development" ? { port: 5174 } : undefined,
	build: {
		// Vite 8 defaults to Lightning CSS for CSS minification. The project uses
		// Tailwind CSS 3.4.13 with its PostCSS-based pipeline and tailwind.config.js,
		// so keep esbuild minification to avoid downstream build issues.
		cssMinify: "esbuild",
	},
}));
