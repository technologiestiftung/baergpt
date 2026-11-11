import { Hono } from "hono";
import type { Context } from "hono";
import path from "node:path";
import { config } from "../config";
import {
	OUTPUT_DIR,
	execInSandbox,
	sandboxPodName,
} from "../tools/code-sandbox/sandbox-pod";

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

const sandbox = new Hono();

// Route: download a file the sandbox of this chat wrote to its output folder
sandbox.get("/files/:chatId", async (c: Context) => {
	if (!config.featureFlagCodeSandboxAllowed) {
		return c.json({ error: "Not found" }, 404);
	}

	const userId = c.get("authenticatedUserId");
	if (!userId) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const relativePath = path.posix.normalize(c.req.query("path") ?? "");
	if (
		!relativePath ||
		relativePath === "." ||
		relativePath.startsWith("..") ||
		path.posix.isAbsolute(relativePath)
	) {
		return c.json({ error: "Invalid path" }, 400);
	}

	const podName = sandboxPodName(userId, c.req.param("chatId"));
	const filePath = `${OUTPUT_DIR}/${relativePath}`;
	const result = await execInSandbox(podName, [
		"head",
		"--bytes",
		String(MAX_DOWNLOAD_BYTES),
		filePath,
	]);
	if (result.exitCode !== 0) {
		return c.json({ error: "File is no longer available" }, 404);
	}

	const fileName = encodeURIComponent(path.posix.basename(relativePath));
	return c.body(new Uint8Array(result.stdout), 200, {
		"Content-Type": "application/octet-stream",
		"Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
	});
});

export default sandbox;
