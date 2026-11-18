import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Context, Next } from "hono";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import { createUserScopedDbClient } from "../supabase";

type AuthenticatedSession = {
	userId: string;
	userClient: ReturnType<typeof createUserScopedDbClient>;
};

/**
 * Verifies a Supabase session token and checks that the user is neither
 * banned nor deleted. Returns null when the session is not valid.
 */
export async function authenticateToken(
	token: string,
): Promise<AuthenticatedSession | null> {
	if (!token) {
		return null;
	}

	let decodedToken: null | { exp?: number; sub?: string } = null;

	try {
		decodedToken = (await verify(token, config.supabaseJwtKey, "HS256")) as {
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

	const userClient = createUserScopedDbClient(token);
	const { data: isUserBannedOrDeleted, error } = await userClient.rpc(
		"is_current_user_banned_or_deleted",
	);

	if (error) {
		captureError(error);
		return null;
	}

	if (isUserBannedOrDeleted) {
		captureError(new Error("User account was banned"));
		return null;
	}

	return { userId: decodedToken.sub, userClient };
}

const basicAuth = createMiddleware(async (c: Context, next: Next) => {
	const authorizationHeader = c.req.header("authorization") || "";
	const token = authorizationHeader.replace("Bearer ", "");

	const session = await authenticateToken(token);
	if (!session) {
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	c.set("UserScopedDbClient", session.userClient);
	c.set("authenticatedUserId", session.userId);
	return next();
});

export default basicAuth;
