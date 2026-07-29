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
		// Vite 8 defaults to Lightning CSS for CSS minification, which does not yet
		// understand Tailwind v4 at-rules like @theme / @utility / @custom-variant.
		// Keep esbuild minification until Tailwind / Lightning CSS are aligned.
		cssMinify: "esbuild",
	},
}));
