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
