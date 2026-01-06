import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Context, Next } from "hono";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import { createUserScopedDbClient } from "../supabase";

const basicAuth = createMiddleware(async (c: Context, next: Next) => {
	const authorizationHeader = c.req.header("authorization") || "";
	const token = authorizationHeader.replace("Bearer ", "");

	if (!token) {
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	let decodedToken: null | { exp?: number; sub?: string } = null;

	try {
		decodedToken = (await verify(token, config.supabaseJwtKey)) as {
			exp?: number;
			sub?: string;
		};
	} catch (error) {
		captureError(error);
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	if (decodedToken.exp && decodedToken.exp < Date.now() / 1000) {
		captureError(new Error("Supabase session token expired"));
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	if (!decodedToken.sub) {
		captureError(new Error("Supabase session token missing user ID"));
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	const userClient = createUserScopedDbClient(token);
	const { data: isActive, error } = await userClient.rpc(
		"is_current_user_active",
	);

	if (error) {
		captureError(error);
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	if (!isActive) {
		captureError(new Error("User account is deactivated or not found"));
		return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
	}

	c.set("UserScopedDbClient", userClient);
	c.set("authenticatedUserId", decodedToken.sub);
	return next();
});

export default basicAuth;
