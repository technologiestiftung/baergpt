import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Context, Next } from "hono";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import { createUserClient } from "../supabase";

const AUTH_CONTEXT_KEY = "supabaseAuth" as const;

type AuthContextValue = {
	userId: string;
	accessToken: string;
};

export function getAuthContext(c: Context): AuthContextValue {
	const value = c.get(AUTH_CONTEXT_KEY) as AuthContextValue | undefined;
	if (!value) {
		throw new Error("Auth context missing on request");
	}
	return value;
}

export function getUserClient(c: Context) {
	const { accessToken } = getAuthContext(c);
	return createUserClient(accessToken);
}

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

	// Store auth context first so getUserClient() works
	c.set(AUTH_CONTEXT_KEY, {
		userId: decodedToken.sub,
		accessToken: token,
	});

	// Use user's own JWT to check active status via RPC (no service role needed)
	const userClient = createUserClient(token);
	const { data: isActive, error } = await userClient.rpc(
		"is_current_user_active",
	);

	if (error) {
		captureError(error);
		return false;
	}

	if (!isActive) {
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
