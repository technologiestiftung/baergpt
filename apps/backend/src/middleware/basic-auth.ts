import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { config } from "../config";
import type { Context, Next } from "hono";
import { DatabaseService } from "../services/database-service";
import { captureError } from "../monitoring/capture-error";

const databaseService = new DatabaseService();

async function hasValidSupabaseSession(c: Context): Promise<boolean> {
	const authorizationHeader = c.req.header("authorization") || "";
	const token = authorizationHeader.replace("Bearer ", "");

	if (!token) {
		return false;
	}

	let decodedToken: null | { exp?: number; sub?: string } = null;

	try {
		decodedToken = (await verify(token, config.supabaseJwtKey)) as {
			exp?: number;
			sub?: string;
		};
	} catch (error) {
		captureError(error);
		return false;
	}

	if (decodedToken.exp && decodedToken.exp < Date.now() / 1000) {
		captureError(new Error("Supabase session token expired"));
		return false;
	}

	if (!decodedToken.sub) {
		captureError(new Error("Supabase session token missing user ID"));
		return false;
	}

	const { is_active } = await databaseService.getUserActiveStatus(
		decodedToken.sub,
	);

	if (!is_active) {
		captureError(new Error("User account is deactivated or not found"));
		return false;
	}

	return true;
}

const basicAuth = createMiddleware(async (c: Context, next: Next) => {
	try {
		if (await hasValidSupabaseSession(c)) {
			return next();
		}

		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default basicAuth;
