import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import { UserScopedDbService } from "../services/db-service/user-scoped-db-service";
import { captureError } from "../monitoring/capture-error";

export const adminAuth = createMiddleware(async (c: Context, next: Next) => {
	const UserScopedDbClient = c.get("UserScopedDbClient");
	const userScopedDbService = new UserScopedDbService(UserScopedDbClient);
	const userId = c.get("authenticatedUserId");

	if (!userId) {
		return c.json({ error: "Unauthorized or invalid token" }, 401);
	}

	let isAdmin = false;
	try {
		isAdmin = await userScopedDbService.getUserAdminStatus();
	} catch (error) {
		captureError(error);
	}

	if (!isAdmin) {
		return c.json({ error: "Forbidden" }, 403);
	}

	return next();
});

export async function getUserIdFromRequest(c: Context): Promise<string | null> {
	const authHeader = c.req.header("authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}
	const token = authHeader.replace("Bearer ", "");

	try {
		const payload = JSON.parse(
			Buffer.from(token.split(".")[1], "base64").toString(),
		);
		return payload.sub;
	} catch {
		return null;
	}
}
