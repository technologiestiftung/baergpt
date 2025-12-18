import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { config } from "../config";
import type { Context, Next } from "hono";
import { DatabaseService } from "../services/database-service";
import { captureError } from "../monitoring/capture-error";

const databaseService = new DatabaseService();

/**
 * Validates the Supabase session and extracts the authenticated user ID.
 * Returns the user ID if valid, null otherwise.
 */
async function validateSupabaseSession(c: Context): Promise<string | null> {
	const authorizationHeader = c.req.header("authorization") || "";
	const token = authorizationHeader.replace("Bearer ", "");

	if (!token) {
		return null;
	}

	let decodedToken: null | { exp?: number; sub?: string } = null;

	try {
		decodedToken = (await verify(token, config.supabaseJwtKey)) as {
			exp?: number;
			sub?: string;
		};
	} catch (error) {
		captureError(error);
		return null;
	}

	if (decodedToken.exp && decodedToken.exp < Date.now() / 1000) {
		captureError(new Error("Supabase session token expired"));
		return null;
	}

	if (!decodedToken.sub) {
		captureError(new Error("Supabase session token missing user ID"));
		return null;
	}

	const { is_active } = await databaseService.getUserActiveStatus(
		decodedToken.sub,
	);

	if (!is_active) {
		captureError(new Error("User account is deactivated or not found"));
		return null;
	}

	return decodedToken.sub;
}

const basicAuth = createMiddleware(async (c: Context, next: Next) => {
	try {
		const userId = await validateSupabaseSession(c);

		if (userId) {
			// Store authenticated user ID in context for use by route handlers
			c.set("authenticatedUserId", userId);
			return next();
		}

		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

/**
 * Helper function to get the authenticated user ID from context.
 * Should only be called after basicAuth middleware has run.
 */
export function getAuthenticatedUserId(c: Context): string {
	const userId = c.get("authenticatedUserId");
	if (!userId) {
		throw new Error(
			"authenticatedUserId not found in context - basicAuth middleware may not have run",
		);
	}
	return userId;
}

export default basicAuth;
